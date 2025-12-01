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
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
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
WORK_END_HOUR = 17
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
    print(f"--- Challenge Request for: {payload.username} ---")
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    
    if not user:
        print("User not found.")
        raise HTTPException(401, "Invalid credentials")
    
    if not utils.verify_pin(payload.pin, user.password_hash):
        print("PIN Verification Failed.")
        raise HTTPException(401, "Invalid credentials")
    
    print("PIN Verified. Generating Challenge.")
    code = utils.generate_challenge_code()
    challenge = models.Challenge(username=payload.username, challenge_code=code, expires_at=datetime.utcnow()+timedelta(seconds=300))
    db.add(challenge)
    db.commit()
    return {"challenge": code}

@app.post("/register")
async def register_user(
    username: str = Form(...),
    pin: str = Form(...),
    role: str = Form("employee"), 
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n--- REGISTERING USER: {username} ({role}) ---")
    
    if db.query(models.User).filter(models.User.username == username).first():
        print("Registration Failed: Username already exists.")
        raise HTTPException(400, "Username exists")

    embeddings = []
    try:
        for i, f in enumerate(files):
            print(f"Processing sample {i+1}...")
            temp = f"uploads/{f.filename}"
            with open(temp, "wb") as b:
                b.write(await f.read())
            
            # GATE 0: Noise Reduction
            print("Gate 0: Enhancing Audio...")
            clean = utils.load_and_enhance_audio(temp)
            if clean is None:
                print(f"Sample {i+1} Failed: Audio bad/silent.")
                raise HTTPException(400, "Audio processing failed")
            
            # GATE 1: Anti-Spoof (Even for registration)
            print("Gate 1: Deepfake Detection...")
            is_real, conf, label = utils.check_spoofing(temp)
            print(f"Spoof Result: {label} (Confidence: {conf:.4f})")
            
            if not is_real:
                print("Registration REJECTED: Synthetic audio detected.")
                raise HTTPException(400, "Registration rejected. Synthetic audio detected.")

            embeddings.append(utils.get_voice_embedding(clean))
            os.remove(temp)
        
        print("Generating Voiceprint...")
        avg_emb = np.mean(embeddings, axis=0)
        enc_blob = utils.encrypt_voiceprint(avg_emb)
        
        print("Hashing PIN and Saving to DB...")
        new_user = models.User(
            username=username,
            password_hash=utils.hash_pin(pin),
            salt="bcrypt",
            voiceprint=enc_blob,
            role=role
        )
        db.add(new_user)
        db.commit()
        print("Registration Successful!")
        return {"status": "success", "message": "User registered"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(500, "Internal Server Error")

# --- LOGIN (CLOCK IN) ---
@app.post("/login")
async def login_user(
    username: str = Form(...),
    pin: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n--- LOGIN ATTEMPT: {username} ---")
    
    # 1. Basic Auth
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        print("User not found in DB.")
        raise HTTPException(401, "Invalid credentials")
        
    if not utils.verify_pin(pin, user.password_hash):
        print("PIN Mismatch.")
        raise HTTPException(401, "Invalid credentials")
    
    print("PIN Verified.")

    # 2. Voice Auth
    temp = f"uploads/login_{username}.webm"
    with open(temp, "wb") as b:
        b.write(await audio_file.read())
    
    try:
        # GATE 0: Noise
        print("Gate 0: Cleaning Audio (Noise Reduction)...")
        clean = utils.load_and_enhance_audio(temp)
        if clean is None: 
            print("Gate 0 FAILED: Audio bad or silent.")
            raise HTTPException(400, "Audio bad")
        
        # GATE 1: Anti-Spoof
        print("Gate 1: Anti-Spoofing (Deepfake Check)...")
        is_real, conf, label = utils.check_spoofing(temp)
        
        if not is_real: 
            print(f"Gate 1 REJECTED: Spoof Detected! Label: {label}, Conf: {conf:.4f}")
            raise HTTPException(403, "Spoof detected")
        
        print(f"Gate 1 PASSED: Audio is Real Human (Conf: {conf:.4f})")
        
        # GATE 2: Biometrics
        print("Gate 2: Biometric Matching...")
        login_emb = utils.get_voice_embedding(clean)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        score = utils.compare_faces(login_emb, stored_emb)
        
        print(f">> SIMILARITY SCORE: {score:.4f} <<")
        
        THRESHOLD = 0.50
        if score < THRESHOLD:
            print(f"Gate 2 FAILED: Score {score:.4f} is below threshold {THRESHOLD}")
            raise HTTPException(401, "Voice mismatch")
        
        print("Gate 2 PASSED: Identity Verified.")
            
        # 3. CLOCK IN LOGIC
        today = datetime.utcnow().date()
        attendance = db.query(models.Attendance).filter(
            models.Attendance.user_id == user.id,
            func.date(models.Attendance.date) == today,
            models.Attendance.clock_out == None
        ).first()
        
        if not attendance:
            print("Clocking user in...")
            attendance = models.Attendance(
                user_id=user.id,
                username=user.username,
                clock_in=datetime.utcnow(),
                status="Working"
            )
            db.add(attendance)
            db.commit()
        else:
            print("User already clocked in.")
            
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
@app.post("/admin/assign_task")
def assign_task(task_data: TaskCreate, admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    employee = db.query(models.User).filter(models.User.username == task_data.assigned_to_username).first()
    if not employee: raise HTTPException(404, "Employee not found")
    
    task = models.Task(title=task_data.title, description=task_data.description, user_id=employee.id)
    db.add(task)
    db.commit()
    print(f"Task '{task_data.title}' assigned to {employee.username} by {admin.username}")
    return {"message": "Task assigned"}

@app.get("/admin/all_attendance")
def get_all_attendance(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Attendance).all()

# --- EMPLOYEE ENDPOINTS ---
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
    print(f"Task {task_id} completed by {user.username}")
    return {"message": "Task marked complete"}

# --- CLOCK OUT ---
@app.post("/clock_out")
def clock_out(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    print(f"\n--- CLOCK OUT ATTEMPT: {user.username} ---")
    
    attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == user.id,
        models.Attendance.clock_out == None
    ).order_by(models.Attendance.clock_in.desc()).first()
    
    if not attendance: return {"message": "You are not clocked in."}
    
    now = datetime.utcnow()
    attendance.clock_out = now
    
    pending_tasks = db.query(models.Task).filter(models.Task.user_id == user.id, models.Task.is_completed == False).count()
    print(f"Pending Tasks: {pending_tasks}")
    
    today_5pm = now.replace(hour=WORK_END_HOUR, minute=0, second=0, microsecond=0)
    is_early = now < today_5pm
    
    fine = 0.0
    status = "Shift Completed"
    
    if not is_early:
        status = "Shift Completed (On Time)"
    elif is_early and pending_tasks == 0:
        status = "Left Early (Authorized - Work Done)"
    elif is_early and pending_tasks > 0:
        hours_remaining = (today_5pm - now).total_seconds() / 3600
        fine = round(hours_remaining * FINE_PER_HOUR_REMAINING, 2)
        status = f"Left Early (Fined: Tasks Pending)"
        print(f"FINE APPLIED: ${fine} (Left {hours_remaining:.2f} hours early with tasks)")
    
    attendance.status = status
    attendance.fine_amount = fine
    db.commit()
    
    return {
        "status": status,
        "clock_out_time": now.isoformat(),
        "pending_tasks": pending_tasks,
        "fine_applied": f"${fine}",
        "message": "You have been clocked out."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)