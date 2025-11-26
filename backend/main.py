from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from sqlalchemy.orm import Session
# --- CORRECTED IMPORT: Import 'engine' from database, not models ---
from database import get_db, engine 
import models
import utils

# Initialize Database Tables
# Fixed: Use 'engine' directly
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Secure Voice MFA System")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

@app.get("/")
def home():
    return {"message": "Secure Voice MFA Backend Running - ALL GATES ACTIVE"}

# ==========================================
# PHASE 1: ENROLLMENT (Register)
# ==========================================
@app.post("/register")
async def register_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"--- Registering User: {username} ---")

    # 1. Database Check
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists.")

    # 2. Save File Temporarily
    temp_filename = f"uploads/reg_{username}_{audio_file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    try:
        # 3. GATE 0: Load & Enhance Audio (Remove Noise)
        print("Step 1: Enhancing Audio...")
        clean_signal = utils.load_and_enhance_audio(temp_filename)
        
        if clean_signal is None:
            raise HTTPException(status_code=400, detail="Audio file corrupted or unreadable.")

        # 4. GATE 1: Anti-Spoof Check (Uses file path)
        print("Step 2: Deepfake Detection...")
        is_real, confidence, label = utils.check_spoofing(temp_filename)
        print(f"Spoof Result: {label} ({confidence:.4f})")
        
        if not is_real:
            raise HTTPException(status_code=400, detail="Registration rejected. Synthetic audio detected.")

        # 5. Extract Voice Embedding
        print("Step 3: Generating & Encrypting Voiceprint...")
        embedding = utils.get_voice_embedding(clean_signal)

        # 6. Encrypt (AES-256)
        print("Step 3: Encrypting Data...")
        encrypted_blob = utils.encrypt_voiceprint(embedding)

        # 7. Hash PIN
        hashed_pin = utils.hash_pin(pin)

        # 8. Save to DB
        new_user = models.User(
            username=username,
            password_hash=hashed_pin,
            salt="bcrypt",
            voiceprint=encrypted_blob
        )
        db.add(new_user)
        db.commit()
        
        return {"status": "success", "message": "User registered securely."}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error.")
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


# ==========================================
# PHASE 2: AUTHENTICATION (Login)
# ==========================================
@app.post("/login")
async def login_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n--- Login Attempt: {username} ---")

    # 1. Identity Check
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Credentials")

    # 2. PIN Verification
    if not utils.verify_pin(pin, user.password_hash):
        print("PIN Mismatch")
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    print("PIN Verified.")

    # 3. Audio Processing
    temp_filename = f"uploads/login_{username}_{audio_file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    try:
        # --- GATE 0: Noise Cancellation ---
        print("Gate 0: Cleaning Audio (Noise Reduction)...")
        clean_signal = utils.load_and_enhance_audio(temp_filename)
        if clean_signal is None:
            raise HTTPException(status_code=400, detail="Audio processing failed.")

        # --- GATE 1: Anti-Spoofing (Deepfake Detection) ---
        print("Gate 1: Anti-Spoofing...")
        is_real, confidence, label = utils.check_spoofing(temp_filename)
        
        if not is_real: 
            print(f"REJECTED: Spoof detected ({label})")
            raise HTTPException(status_code=403, detail="Access Denied: Fake Audio Detected.")
        print(f"PASSED: Live Human ({confidence:.4f})")

        # --- GATE 2: Speaker Verification ---
        print("Gate 2: Biometric Matching...")
        
        # Generate new embedding from CLEAN audio
        login_embedding = utils.get_voice_embedding(clean_signal)
        
        # Decrypt stored embedding
        stored_embedding = utils.decrypt_voiceprint(user.voiceprint)
        if stored_embedding is None:
            raise HTTPException(status_code=500, detail="Database Integrity Error.")

        # Compare
        score = utils.compare_faces(login_embedding, stored_embedding)
        print(f"Similarity Score: {score:.4f}")

        THRESHOLD = 0.62 
        
        if score >= THRESHOLD:
            return {
                "status": "success",
                "message": "Access Granted",
                "user": username,
                "score": round(score, 4),
                "checks": ["PIN: OK", "Liveness: OK", "VoiceMatch: OK"]
            }
        else:
            raise HTTPException(status_code=401, detail=f"Voice verification failed. Score: {round(score, 2)}")

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)