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

class RegisterInitRequest(BaseModel):
    username: str
    pin: str
    role: str = "employee"

class UploadSampleRequest(BaseModel):
    username: str
    sample_index: int

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
        print(f"Result: USER NOT FOUND ❌")
        print(f"{'='*60}\n")
        raise HTTPException(401, "Invalid credentials")
    
    if not utils.verify_pin(payload.pin, user.password_hash):
        print(f"Result: PIN MISMATCH ❌")
        print(f"{'='*60}\n")
        raise HTTPException(401, "Invalid credentials")
    
    code = utils.generate_challenge_code()
    challenge = models.Challenge(username=payload.username, challenge_code=code, expires_at=datetime.utcnow()+timedelta(seconds=300))
    db.add(challenge)
    db.commit()
    
    print(f"Challenge Generated: {code}")
    print(f"Expires At: {challenge.expires_at}")
    print(f"Result: SUCCESS ✅")
    print(f"{'='*60}\n")
    
    return {"challenge": code}

@app.get("/check_username/{username}")
def check_username(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        raise HTTPException(409, "Username already taken")
    return {"status": "available", "message": "Username is available"}

@app.post("/register/init")
def register_init(payload: RegisterInitRequest, db: Session = Depends(get_db)):
    print(f"\n{'='*60}")
    print(f"📝 REGISTRATION INIT")
    print(f"{'='*60}")
    print(f"Username: {payload.username}")
    
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(400, "Username already exists")
    
    existing_pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.username == payload.username
    ).first()
    if existing_pending:
        db.delete(existing_pending)
        db.commit()
    
    pending = models.PendingRegistration(
        username=payload.username,
        password_hash=utils.hash_pin(payload.pin),
        role=payload.role,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(pending)
    db.commit()
    
    print(f"Result: INIT SUCCESS ✅")
    print(f"{'='*60}\n")
    
    return {"status": "success", "message": "Registration initialized"}

@app.post("/register/upload_sample")
async def register_upload_sample(
    username: str = Form(...),
    sample_index: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"📤 UPLOAD SAMPLE {sample_index + 1}")
    print(f"{'='*60}")
    print(f"Username: {username}")
    
    pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.username == username
    ).first()
    
    if not pending:
        raise HTTPException(404, "Registration session not found. Please start registration again.")
    
    if datetime.utcnow() > pending.expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(410, "Registration session expired. Please start again.")
    
    if sample_index not in [0, 1, 2]:
        raise HTTPException(400, "Invalid sample index. Must be 0, 1, or 2.")
    
    temp = f"uploads/pending_{username}_sample_{sample_index}.webm"
    
    try:
        with open(temp, "wb") as b:
            b.write(await file.read())
        
        is_valid, snr, is_loud, is_multi, details = utils.check_audio_quality(temp)
        
        if not is_valid:
            msg = "Quality issues detected"
            if is_loud: msg = "Audio is too loud (clipping)"
            elif is_multi: msg = "Multiple speakers detected"
            elif snr < 10: msg = "Too much background noise"
            
            print(f"Audio Quality Check FAILED: {msg}")
            raise HTTPException(400, f"Sample {sample_index + 1} rejected: {msg}")
        
        clean = utils.load_and_enhance_audio(temp)
        if clean is None:
            raise HTTPException(400, "Audio processing failed")
        
        is_real, conf, label = utils.check_spoofing(temp, is_clipped=is_loud)
        if not is_real:
            if is_loud and label == "QUALITY_ISSUE":
                raise HTTPException(400, "Audio is too loud or distorted. Please move further from the microphone and try again.")
            raise HTTPException(400, "Registration rejected. Synthetic audio detected.")
        
        embedding = utils.get_voice_embedding(clean)
        embedding_blob = utils.encrypt_voiceprint(embedding)
        
        if sample_index == 0:
            pending.sample_1_embedding = embedding_blob
        elif sample_index == 1:
            pending.sample_2_embedding = embedding_blob
        elif sample_index == 2:
            pending.sample_3_embedding = embedding_blob
        
        db.commit()
        os.remove(temp)
        
        print(f"Result: SAMPLE {sample_index + 1} UPLOADED ✅")
        print(f"{'='*60}\n")
        
        return {"status": "success", "message": f"Sample {sample_index + 1} uploaded successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {e}")
        print(f"{'='*60}\n")
        if os.path.exists(temp):
            os.remove(temp)
        raise HTTPException(500, str(e))

@app.post("/register/finalize")
def register_finalize(username: str = Form(...), db: Session = Depends(get_db)):
    print(f"\n{'='*60}")
    print(f"✅ REGISTRATION FINALIZE")
    print(f"{'='*60}")
    print(f"Username: {username}")
    
    pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.username == username
    ).first()
    
    if not pending:
        raise HTTPException(404, "Registration session not found")
    
    if datetime.utcnow() > pending.expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(410, "Registration session expired")
    
    if not all([pending.sample_1_embedding, pending.sample_2_embedding, pending.sample_3_embedding]):
        raise HTTPException(400, "All 3 samples must be uploaded before finalizing")
    
    try:
        emb1 = utils.decrypt_voiceprint(pending.sample_1_embedding)
        emb2 = utils.decrypt_voiceprint(pending.sample_2_embedding)
        emb3 = utils.decrypt_voiceprint(pending.sample_3_embedding)
        
        avg_emb = np.mean([emb1, emb2, emb3], axis=0)
        final_blob = utils.encrypt_voiceprint(avg_emb)
        
        new_user = models.User(
            username=pending.username,
            password_hash=pending.password_hash,
            salt="bcrypt",
            voiceprint=final_blob,
            role=pending.role
        )
        db.add(new_user)
        db.delete(pending)
        db.commit()
        
        print(f"Result: REGISTRATION COMPLETE ✅")
        print(f"{'='*60}\n")
        
        return {"status": "success", "message": "Registration completed successfully"}
    
    except Exception as e:
        print(f"Finalize error: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(500, str(e))

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
    print(f"Username: {username}")
    print(f"Role: {role}")
    
    if db.query(models.User).filter(models.User.username == username).first():
        print(f"Result: USERNAME EXISTS ❌")
        print(f"{'='*60}\n")
        raise HTTPException(400, "Username exists")

    embeddings = []
    try:
        for i, f in enumerate(files):
            print(f"\nProcessing audio sample {i+1}/3...")
            temp = f"uploads/{f.filename}"
            with open(temp, "wb") as b:
                b.write(await f.read())
            
            # --- FIXED AUDIO QUALITY CHECK ---
            is_valid, snr, is_loud, is_multi, details = utils.check_audio_quality(temp)
            
            if not is_valid:
                msg = "Quality issues detected"
                if is_loud: msg = "Audio is too loud (clipping)"
                elif is_multi: msg = "Multiple speakers detected"
                elif snr < 10: msg = "Too much background noise"
                
                print(f"Audio Quality Check FAILED: {msg}")
                raise HTTPException(400, f"Sample {i+1} rejected: {msg}")
            
            clean = utils.load_and_enhance_audio(temp)
            if clean is None:
                raise HTTPException(400, "Audio processing failed")
            
            is_real, conf, label = utils.check_spoofing(temp, is_clipped=is_loud)
            if not is_real:
                if is_loud and label == "QUALITY_ISSUE":
                    raise HTTPException(400, "Audio is too loud or distorted. Please move further from the microphone and try again.")
                raise HTTPException(400, "Registration rejected. Synthetic audio detected.")

            embeddings.append(utils.get_voice_embedding(clean))
            os.remove(temp)
        
        avg_emb = np.mean(embeddings, axis=0)
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
        
        print(f"\nResult: REGISTRATION SUCCESS ✅")
        print(f"{'='*60}\n")
        return {"status": "success", "message": "User registered"}
    except Exception as e:
        print(f"Registration error: {e}")
        print(f"{'='*60}\n")
        # Clean up temp file if error occurs
        if 'temp' in locals() and os.path.exists(temp):
            os.remove(temp)
        raise HTTPException(500, str(e))

@app.post("/login")
async def login_user(
    username: str = Form(...),
    pin: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"🔓 LOGIN ATTEMPT")
    print(f"{'='*60}")
    print(f"Username: {username}")
    
    # 1. Basic Auth
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        print(f"Result: USER NOT FOUND ❌")
        print(f"{'='*60}\n")
        raise HTTPException(401, "Invalid credentials")
        
    if not utils.verify_pin(pin, user.password_hash):
        print(f"Result: PIN MISMATCH ❌")
        print(f"{'='*60}\n")
        raise HTTPException(401, "Invalid credentials")
    
    # 2. Voice Auth
    temp = f"uploads/login_{username}.webm"
    with open(temp, "wb") as b:
        b.write(await audio_file.read())
    
    try:
        # --- FIXED AUDIO QUALITY CHECK ---
        is_valid, snr, is_loud, is_multi, details = utils.check_audio_quality(temp)

        if not is_valid:
            msg = "Poor audio quality"
            if is_loud: msg = "Audio is too loud (clipping)"
            elif is_multi: msg = "Multiple speakers detected"
            elif snr < 10: msg = "Too much background noise"
            
            raise HTTPException(400, f"Audio quality issue: {msg}. Please find a quieter location.")
        
        clean = utils.load_and_enhance_audio(temp)
        if clean is None: 
            raise HTTPException(400, "Audio processing failed")
        
        is_real, conf, label = utils.check_spoofing(temp, is_clipped=is_loud)
        if not is_real:
            if is_loud and label == "QUALITY_ISSUE":
                raise HTTPException(400, "Audio is too loud or distorted. Please move further from the microphone and try again.")
            raise HTTPException(403, "Spoof detected")
        
        login_emb = utils.get_voice_embedding(clean)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        score = utils.compare_faces(login_emb, stored_emb)
        
        if score < 0.50:
            print(f"Result: VOICE MISMATCH ❌")
            print(f"{'='*60}\n")
            raise HTTPException(401, "Voice mismatch")
            
        # 3. CLOCK IN LOGIC
        today = datetime.utcnow().date()
        attendance = db.query(models.Attendance).filter(
            models.Attendance.user_id == user.id,
            func.date(models.Attendance.date) == today,
            models.Attendance.clock_out == None
        ).first()
        
        if not attendance:
            attendance = models.Attendance(
                user_id=user.id,
                username=user.username,
                clock_in=datetime.utcnow(),
                status="Working"
            )
            db.add(attendance)
            db.commit()
            print(f"✅ User CLOCKED IN at {attendance.clock_in}")
            
        token = create_access_token(user.username, user.role)
        
        print(f"\nResult: LOGIN SUCCESS ✅")
        print(f"{'='*60}\n")
        
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
    
    task = models.Task(
        title=task_data.title, 
        description=task_data.description, 
        user_id=employee.id,
        assigned_at=datetime.utcnow()
    )
    db.add(task)
    db.commit()
    return {"message": "Task assigned"}

@app.get("/admin/all_attendance")
def get_all_attendance(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Attendance).all()

@app.get("/admin/dashboard_stats")
def get_dashboard_stats(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    
    active_employees = db.query(models.Attendance).filter(
        models.Attendance.clock_out == None,
        func.date(models.Attendance.date) == today
    ).count()
    
    completed_shifts = db.query(models.Attendance).filter(
        func.date(models.Attendance.date) == today,
        models.Attendance.clock_out != None
    ).count()
    
    total_tasks = db.query(models.Task).count()
    completed_tasks = db.query(models.Task).filter(models.Task.is_completed == True).count()
    efficiency = round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2)
    
    attendance_graph = []
    for i in range(7):
        day = today - timedelta(days=6-i)
        present = db.query(models.Attendance).filter(func.date(models.Attendance.date) == day).count()
        late_records = db.query(models.Attendance).filter(
            func.date(models.Attendance.date) == day,
            func.extract('hour', models.Attendance.clock_in) > WORK_START_HOUR
        ).count()
        attendance_graph.append({
            "date": day.isoformat(),
            "present_count": present,
            "late_count": late_records
        })
    
    employees = db.query(models.User).filter(models.User.role != "admin").all()
    employee_list = []
    
    for emp in employees:
        today_attendance = db.query(models.Attendance).filter(
            models.Attendance.user_id == emp.id,
            func.date(models.Attendance.date) == today,
            models.Attendance.clock_out == None
        ).first()
        
        is_working = today_attendance is not None
        clock_in_time = today_attendance.clock_in.isoformat() if today_attendance else None
        
        total_tasks = db.query(models.Task).filter(models.Task.user_id == emp.id).count()
        completed = db.query(models.Task).filter(
            models.Task.user_id == emp.id,
            models.Task.is_completed == True
        ).count()
        
        employee_list.append({
            "id": emp.id,
            "username": emp.username,
            "status": "Working" if is_working else "Offline",
            "clock_in_time": clock_in_time,
            "tasks_completed": completed,
            "tasks_total": total_tasks,
            "tasks_progress": f"{completed}/{total_tasks}"
        })
    
    return {
        "active_employees": active_employees,
        "completed_shifts": completed_shifts,
        "efficiency": efficiency,
        "attendance_graph": attendance_graph,
        "employee_list": employee_list
    }

# --- EMPLOYEE ENDPOINTS ---
@app.get("/employee/history")
def get_my_history(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(models.Attendance).filter(models.Attendance.user_id == user.id)\
        .order_by(models.Attendance.clock_in.desc()).limit(10).all()
    return {
        "username": user.username,
        "history": history
    }

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

# --- CHECK PENDING TASKS (NEW ENDPOINT) ---
@app.get("/check_pending_tasks")
def check_pending_tasks(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if user has pending tasks before clock out"""
    pending_count = db.query(models.Task).filter(
        models.Task.user_id == user.id,
        models.Task.is_completed == False
    ).count()
    
    now = datetime.utcnow()
    today_5pm = now.replace(hour=WORK_END_HOUR, minute=0, second=0, microsecond=0)
    is_early = now < today_5pm
    
    will_be_fined = is_early and pending_count > 0
    
    if will_be_fined:
        hours_remaining = (today_5pm - now).total_seconds() / 3600
        estimated_fine = round(hours_remaining * FINE_PER_HOUR_REMAINING, 2)
    else:
        estimated_fine = 0.0
    
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
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"\n{'='*60}")
    print(f"🕐 CLOCK OUT REQUEST")
    print(f"{'='*60}")
    print(f"Username: {user.username}")
    
    attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == user.id,
        models.Attendance.clock_out == None
    ).order_by(models.Attendance.clock_in.desc()).first()
    
    if not attendance:
        print(f"Result: NOT CLOCKED IN ❌")
        print(f"{'='*60}\n")
        return {"message": "You are not clocked in."}
    
    # Voice verification for clock out
    temp = f"uploads/clockout_{user.username}.webm"
    with open(temp, "wb") as b:
        b.write(await audio_file.read())
    
    try:
        # --- FIXED AUDIO QUALITY CHECK ---
        is_valid, snr, is_loud, is_multi, details = utils.check_audio_quality(temp)
        
        if not is_valid:
            msg = "Poor audio quality"
            if is_loud: msg = "Audio is too loud (clipping)"
            elif is_multi: msg = "Multiple speakers detected"
            elif snr < 10: msg = "Too much background noise"

            raise HTTPException(400, f"Audio quality issue: {msg}. Please find a quieter location.")
        
        clean = utils.load_and_enhance_audio(temp)
        if clean is None:
            raise HTTPException(400, "Audio processing failed")
        
        is_real, conf, label = utils.check_spoofing(temp, is_clipped=is_loud)
        if not is_real:
            if is_loud and label == "QUALITY_ISSUE":
                raise HTTPException(400, "Audio is too loud or distorted. Please move further from the microphone and try again.")
            raise HTTPException(403, "Spoof detected")
        
        logout_emb = utils.get_voice_embedding(clean)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        score = utils.compare_faces(logout_emb, stored_emb)
        
        if score < 0.50:
            print(f"Result: VOICE VERIFICATION FAILED ❌")
            print(f"{'='*60}\n")
            raise HTTPException(401, "Voice verification failed for clock out")
        
        # Voice verified - proceed with clock out
        now = datetime.utcnow()
        attendance.clock_out = now
        
        pending_tasks = db.query(models.Task).filter(
            models.Task.user_id == user.id,
            models.Task.is_completed == False
        ).count()
        
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
            status = f"Left Early (Fined)"
        
        attendance.status = status
        attendance.fine_amount = fine
        db.commit()
        
        print(f"Clock Out Time: {now}")
        print(f"Pending Tasks: {pending_tasks}")
        print(f"Fine Applied: ${fine}")
        print(f"Status: {status}")
        print(f"Result: CLOCK OUT SUCCESS ✅")
        print(f"{'='*60}\n")
        
        return {
            "status": status,
            "clock_out_time": now.isoformat(),
            "fine_applied": f"${fine}",
            "pending_tasks": pending_tasks
        }
    finally:
        if os.path.exists(temp):
            os.remove(temp)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)