from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import shutil
import numpy as np
from sqlalchemy.orm import Session
# Ensure database.py is correctly configured
from database import get_db, engine 
import models
import utils

# Create Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Secure Voice MFA System (Enhanced)")
os.makedirs("uploads", exist_ok=True)

# --- FIX 1: CORS CONFIGURATION ---
# This fixes the "Connection Error" on the frontend
origins = [
    "http://localhost:5173",  # Vite/React default
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # CRA default
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store challenges temporarily
active_challenges = {} 

@app.get("/")
def home():
    return {"message": "Enhanced Voice MFA Active"}

# ==========================================
# 1. CHALLENGE GENERATION
# ==========================================
@app.get("/get_challenge/{username}")
def get_challenge(username: str):
    """
    Generates a random phrase (6-7 words) for the user to speak.
    """
    # Note: ensure utils.py is updated to generate 6-7 words
    code = utils.generate_challenge_code() 
    active_challenges[username] = code
    print(f"Generated Challenge for {username}: {code}")
    return {"challenge": code}

# ==========================================
# 2. ENHANCED REGISTRATION
# ==========================================
@app.post("/register")
async def register_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    print(f"--- Registering User: {username} ---")

    try:
        if db.query(models.User).filter(models.User.username == username).first():
            raise HTTPException(status_code=400, detail="Username already exists.")

        if len(files) < 3:
             raise HTTPException(status_code=400, detail="Please provide 3 audio samples.")

        embeddings = []

        # Loop through all 3 files
        for i, audio_file in enumerate(files):
            temp_filename = f"uploads/reg_{username}_{i}_{audio_file.filename}"
            with open(temp_filename, "wb") as buffer:
                shutil.copyfileobj(audio_file.file, buffer)
            
            # Gate 0: Process Audio
            clean_signal = utils.load_and_enhance_audio(temp_filename)
            if clean_signal is None:
                if os.path.exists(temp_filename): os.remove(temp_filename)
                raise HTTPException(status_code=400, detail=f"Sample {i+1} was poor quality.")

            # Gate 1: Anti-Spoof (Commented out for easier testing, uncomment for prod)
            # is_real, conf, label = utils.check_spoofing(temp_filename)
            # if not is_real:
            #     os.remove(temp_filename)
            #     raise HTTPException(status_code=400, detail=f"Sample {i+1} detected as FAKE/AI.")
            
            os.remove(temp_filename) # Cleanup file

            # Get Embedding
            emb = utils.get_voice_embedding(clean_signal)
            embeddings.append(emb)

        # Average the 3 embeddings
        avg_embedding = np.mean(embeddings, axis=0)

        # Encrypt & Save
        encrypted_blob = utils.encrypt_voiceprint(avg_embedding)
        hashed_pin = utils.hash_pin(pin)

        new_user = models.User(
            username=username,
            password_hash=hashed_pin,
            salt="bcrypt",
            voiceprint=encrypted_blob
        )
        db.add(new_user)
        db.commit()
        
        return {"status": "success", "message": "User registered successfully."}

    # --- FIX 2: CATCH HTTP EXCEPTIONS ---
    except HTTPException as he:
        raise he  # Re-raise known errors (like 400 Bad Request) so they reach frontend
    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# ==========================================
# 3. ENHANCED LOGIN
# ==========================================
@app.post("/login")
async def login_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"\n--- Login Attempt: {username} ---")

    # 1. Check Identity
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user: raise HTTPException(status_code=401, detail="User not found")

    # 2. PIN Check
    if not utils.verify_pin(pin, user.password_hash):
         raise HTTPException(status_code=401, detail="Wrong PIN")

    # 3. Retrieve Challenge
    expected_code = active_challenges.get(username)
    if not expected_code:
        raise HTTPException(status_code=400, detail="Challenge expired. Please click 'Get Challenge' again.")

    temp_filename = f"uploads/login_{username}_{audio_file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    try:
        # --- PHASE A: Challenge Verification (Word Matching) ---
        transcript = utils.transcribe_audio(temp_filename)
        print(f"Expected: {expected_code}")
        print(f"Spoken:   {transcript}")
        
        # FIX 3: WORD MATCHING LOGIC (For 6-7 words)
        expected_words = expected_code.split() # e.g. ["ALPHA", "BRAVO", "CHARLIE", ...]
        
        # Count how many expected words appear in the transcript
        matches = 0
        for word in expected_words:
            if word in transcript: 
                matches += 1
        
        # Allow some margin of error (e.g., missed 2 words out of 7 is okay)
        required_matches = max(len(expected_words) - 2, 1) 
        
        if matches < required_matches:
             print(f"STT FAILED: Found {matches}/{len(expected_words)} words")
             raise HTTPException(status_code=403, detail=f"Challenge Failed. Detected: '{transcript}'")
        
        print(f"STT PASSED: Found {matches}/{len(expected_words)} words")

        # --- PHASE B: Voice Analysis ---
        clean_signal = utils.load_and_enhance_audio(temp_filename)
        if clean_signal is None: raise HTTPException(status_code=400, detail="Audio unclear")

        # Anti-Spoof
        is_real, conf, _ = utils.check_spoofing(temp_filename)
        if not is_real: raise HTTPException(status_code=403, detail="Spoof Detected (Synthetic Audio)")

        # Matching
        login_emb = utils.get_voice_embedding(clean_signal)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        
        score = utils.compare_faces(login_emb, stored_emb)
        print(f"Biometric Score: {score}")

        THRESHOLD = 0.65 

        if score >= THRESHOLD:
            del active_challenges[username]
            return {"status": "success", "user": username, "score": score}
        else:
            raise HTTPException(status_code=401, detail=f"Voice not recognized (Score: {score:.2f})")

    finally:
        if os.path.exists(temp_filename): os.remove(temp_filename)