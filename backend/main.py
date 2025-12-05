from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from pydantic import BaseModel
import os
import shutil
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, time
from dateutil import parser # NEED TO INSTALL: pip install python-dateutil
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address
import jwt

load_dotenv()
from database import get_db, engine
import models
import utils

models.Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Corporate Voice MFA & Task System")
app.state.limiter = limiter

os.makedirs("uploads", exist_ok=True)

# --- BUSINESS LOGIC CONFIG ---
WORK_START_HOUR = 9
WORK_END_HOUR = 17 # 5 PM
FINE_PER_HOUR_REMAINING = 50.0

# --- JWT & SECURITY ---
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev_secret")
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_username: str

class ChallengeRequest(BaseModel):
    username: str
    pin: str

# --- HELPERS ---
def create_access_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user: raise HTTPException(401, "User not found")
        return user
    except Exception: raise HTTPException(401, "Invalid token")

def get_current_admin(user: models.User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admin privileges required")
    return user

# --- ENDPOINTS ---

@app.post("/get_challenge")
def get_challenge(payload: ChallengeRequest, db: Session = Depends(get_db)):
    print(f"\n{'='*60}")
    print(f"🔐 CHALLENGE REQUEST")
    print(f"{'='*60}")
    print(f"Username: {payload.username}")
    
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    
    if not user:
        raise HTTPException(401, "Invalid credentials")
    
    if not utils.verify_pin(payload.pin, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    code = utils.generate_challenge_code()
    challenge = models.Challenge(username=payload.username, challenge_code=code, expires_at=datetime.utcnow()+timedelta(seconds=300))
    db.add(challenge)
    db.commit()
    
    print(f"Challenge Generated: {code}")
    return {"challenge": code}

@app.post("/register")
async def register_user(
    username: str = Form(...),
    pin: str = Form(...),
    role: str = Form("employee"), 
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"📝 REGISTRATION REQUEST")
    print(f"{'='*60}")
    
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(400, "Username exists")

    valid_embeddings = []
    total_samples = len(files)

    try:
        for i, f in enumerate(files):
            print(f"\nProcessing audio sample {i+1}/{total_samples}...")
            temp = f"uploads/{f.filename}"
            with open(temp, "wb") as b:
                b.write(await f.read())
            
            utils.check_audio_quality(temp)
            
            clean = utils.load_and_enhance_audio(temp)
            if clean is None:
                os.remove(temp)
                continue
            
            is_real, conf, label = utils.check_spoofing(temp)
            if not is_real:
                print(f"❌ Sample {i+1} rejected as FAKE/SPOOF")
                os.remove(temp)
                continue

            valid_embeddings.append(utils.get_voice_embedding(clean))
            os.remove(temp)
        
        if len(valid_embeddings) < (total_samples / 2):
             raise HTTPException(400, "Registration failed: Too many poor quality or suspicious audio samples.")

        avg_emb = np.mean(valid_embeddings, axis=0)
        enc_blob = utils.encrypt_voiceprint(avg_emb)
        
        new_user = models.User(
            username=username,
            password_hash=utils.hash_pin(pin),
            salt="bcrypt",
            voiceprint=enc_blob,
            role=role
        )
        db.add(new_user)
        db.commit()
        
        return {"status": "success", "message": "User registered"}
    except Exception as e:
        if 'temp' in locals() and os.path.exists(temp): os.remove(temp)
        raise HTTPException(500, str(e))

@app.post("/login")
async def login_user(
    username: str = Form(...),
    pin: str = Form(...),
    audio_file: UploadFile = File(...),
    client_time: str = Form(...), # <--- NEW: Get time from user's PC
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"🔓 LOGIN ATTEMPT")
    print(f"{'='*60}")
    print(f"Username: {username}")
    
    # Parse Client Time for Clock In
    try:
        clock_in_time = parser.isoparse(client_time)
        if clock_in_time.tzinfo is not None:
            clock_in_time = clock_in_time.replace(tzinfo=None)
        print(f"🕒 User Clock-In Time: {clock_in_time}")
    except:
        clock_in_time = datetime.now()
    
    # 1. Basic Auth
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not utils.verify_pin(pin, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    # 2. Voice Auth
    temp = f"uploads/login_{username}.webm"
    with open(temp, "wb") as b:
        b.write(await audio_file.read())
    
    try:
        utils.check_audio_quality(temp)
        
        clean = utils.load_and_enhance_audio(temp)
        if clean is None: raise HTTPException(400, "Audio processing failed")
        
        is_real, conf, label = utils.check_spoofing(temp)
        if not is_real: raise HTTPException(403, "Spoof detected")
        
        login_emb = utils.get_voice_embedding(clean)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        score = utils.compare_faces(login_emb, stored_emb)
        
        if score < 0.50:
            raise HTTPException(401, "Voice mismatch")
            
        # 3. CLOCK IN LOGIC (Using Client Time)
        today_start = clock_in_time.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = clock_in_time.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        attendance = db.query(models.Attendance).filter(
            models.Attendance.user_id == user.id,
            models.Attendance.date >= today_start,
            models.Attendance.date <= today_end,
            models.Attendance.clock_out == None
        ).first()
        
        if not attendance:
            attendance = models.Attendance(
                user_id=user.id,
                username=user.username,
                date=clock_in_time,
                clock_in=clock_in_time, # Using user's time
                status="Working"
            )
            db.add(attendance)
            db.commit()
            print(f"✅ User CLOCKED IN at {attendance.clock_in} (Client Time)")
            
        token = create_access_token(user.username, user.role)
        
        return {
            "status": "success",
            "role": user.role,
            "token": token,
            "clock_in_time": attendance.clock_in.isoformat()
        }
    finally:
        if os.path.exists(temp): os.remove(temp)

# --- ADMIN ENDPOINTS ---
@app.get("/admin/users")
def get_all_users(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [{"username": u.username, "role": u.role, "id": u.id, "last_login": u.last_login} for u in users]

@app.get("/admin/all_tasks")
def get_all_tasks(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Task).all()

@app.post("/admin/assign_task")
def assign_task(task_data: TaskCreate, admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    employee = db.query(models.User).filter(models.User.username == task_data.assigned_to_username).first()
    if not employee: raise HTTPException(404, "Employee not found")
    task = models.Task(title=task_data.title, description=task_data.description, user_id=employee.id)
    db.add(task)
    db.commit()
    return {"message": "Task assigned"}

@app.get("/admin/all_attendance")
def get_all_attendance(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Attendance).all()

@app.get("/employee/history")
def get_my_history(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(models.Attendance).filter(models.Attendance.user_id == user.id)\
        .order_by(models.Attendance.clock_in.desc()).limit(10).all()
    return {"username": user.username, "history": history}

@app.get("/employee/tasks")
def get_my_tasks(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.user_id == user.id).all()

@app.put("/employee/complete_task/{task_id}")
def complete_task(task_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user.id).first()
    if not task: raise HTTPException(404, "Task not found")
    task.is_completed = True
    task.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Task marked complete"}

# --- CHECK PENDING TASKS ---
@app.get("/check_pending_tasks")
def check_pending_tasks(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    pending_count = db.query(models.Task).filter(
        models.Task.user_id == user.id,
        models.Task.is_completed == False
    ).count()
    
    # NOTE: This endpoint still uses Server time for the preview. 
    # The actual clock-out call will use client time.
    now = datetime.now() 
    today_5pm = now.replace(hour=WORK_END_HOUR, minute=0, second=0, microsecond=0)
    is_early = now < today_5pm
    
    will_be_fined = is_early and pending_count > 0
    estimated_fine = 0.0
    if will_be_fined:
        hours_remaining = (today_5pm - now).total_seconds() / 3600
        estimated_fine = round(hours_remaining * FINE_PER_HOUR_REMAINING, 2)
    
    return {
        "pending_tasks": pending_count,
        "is_early_departure": is_early,
        "will_be_fined": will_be_fined,
        "estimated_fine": estimated_fine,
        "message": f"You have {pending_count} pending task(s)" if pending_count > 0 else "All tasks completed"
    }

# --- VOICE-AUTHENTICATED CLOCK OUT ---
@app.post("/clock_out")
async def clock_out(
    audio_file: UploadFile = File(...),
    client_time: str = Form(...), # <--- NEW: Get time from user's PC
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"🕐 CLOCK OUT REQUEST")
    print(f"{'='*60}")
    print(f"Username: {user.username}")
    
    # Parse Client Time
    try:
        clock_out_time = parser.isoparse(client_time)
        if clock_out_time.tzinfo is not None:
            clock_out_time = clock_out_time.replace(tzinfo=None)
        print(f"🕒 User Clock-Out Time: {clock_out_time}")
    except:
        clock_out_time = datetime.now()

    attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == user.id,
        models.Attendance.clock_out == None
    ).order_by(models.Attendance.clock_in.desc()).first()
    
    if not attendance:
        return {"message": "You are not clocked in."}
    
    # Voice verification
    temp = f"uploads/clockout_{user.username}.webm"
    with open(temp, "wb") as b:
        b.write(await audio_file.read())
    
    try:
        utils.check_audio_quality(temp)
        clean = utils.load_and_enhance_audio(temp)
        if clean is None: raise HTTPException(400, "Audio processing failed")
        
        is_real, conf, label = utils.check_spoofing(temp)
        if not is_real: raise HTTPException(403, "Spoof detected")
        
        logout_emb = utils.get_voice_embedding(clean)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        score = utils.compare_faces(logout_emb, stored_emb)
        
        if score < 0.50:
            raise HTTPException(401, "Voice verification failed for clock out")
        
        # --- FINE CALCULATION LOGIC (Using Client Time) ---
        attendance.clock_out = clock_out_time
        
        pending_tasks = db.query(models.Task).filter(
            models.Task.user_id == user.id,
            models.Task.is_completed == False
        ).count()
        
        # Determine 5 PM on the user's specific date
        user_5pm = clock_out_time.replace(hour=WORK_END_HOUR, minute=0, second=0, microsecond=0)
        
        # Check if they left before 5 PM (User Time)
        is_early = clock_out_time < user_5pm
        
        fine = 0.0
        status = "Shift Completed"
        
        if not is_early:
            status = "Shift Completed (On Time)"
        elif is_early and pending_tasks == 0:
            status = "Left Early (Authorized - Work Done)"
        elif is_early and pending_tasks > 0:
            # Calculate difference in hours
            diff = user_5pm - clock_out_time
            hours_remaining = diff.total_seconds() / 3600
            
            fine = round(hours_remaining * FINE_PER_HOUR_REMAINING, 2)
            status = f"Left Early (Fined)"
        
        attendance.status = status
        attendance.fine_amount = fine
        db.commit()
        
        print(f"Clock Out Time: {clock_out_time}")
        print(f"Pending Tasks: {pending_tasks}")
        print(f"Fine Applied: ${fine}")
        print(f"Result: CLOCK OUT SUCCESS ✅")
        
        return {
            "status": status,
            "clock_out_time": clock_out_time.isoformat(),
            "fine_applied": f"${fine}",
            "pending_tasks": pending_tasks
        }
    finally:
        if os.path.exists(temp): os.remove(temp)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)