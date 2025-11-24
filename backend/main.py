from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # <--- IMPORT THIS
import os
from sqlalchemy.orm import Session
from fastapi import Depends
from database import get_db
import models
import utils
import os


app = FastAPI(title="Voice Based MFA")

# --- CORS CONFIGURATION ---
origins = [
    "http://localhost:3000",  # The React Frontend
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------

# Create the uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)

@app.get("/")
def home():
    return {"message": "Voice MFA Backend is Running!"}

# --- Phase 1: Enrollment (UPDATED) ---
@app.post("/register")
async def register_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Check if user already exists
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    # 2. Save audio temporarily
    file_location = f"uploads/{audio_file.filename}"
    with open(file_location, "wb") as file_object:
        file_object.write(audio_file.file.read())
    
    # 3. Process Audio (Get Voice Embedding)
    voice_embedding = utils.process_audio_file(file_location)
    
    # Clean up the raw upload
    os.remove(file_location)

    if voice_embedding is None:
        raise HTTPException(status_code=500, detail="Error processing audio file. Ensure FFmpeg is installed.")

    # 4. Encrypt Voiceprint
    encrypted_voice = utils.encrypt_voiceprint(voice_embedding)

    # 5. Hash PIN
    hashed_pin = utils.hash_pin(pin)

    # 6. Save to Database
    new_user = models.User(
        username=username,
        password_hash=hashed_pin,
        salt="bcrypt_handled", # bcrypt handles salt internally, we just store a placeholder or remove this col later
        voiceprint=encrypted_voice
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "status": "success",
        "message": f"User {username} registered successfully!",
        "user_id": new_user.id
    }

# --- Phase 2: Authentication (IMPLEMENTED) ---
@app.post("/login")
async def login_user(
    username: str = Form(...), 
    pin: str = Form(...), 
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Find the user
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 2. Verify PIN
    if not utils.verify_pin(pin, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    # 3. Process the New Audio (Live Sample)
    file_location = f"uploads/login_{username}_{audio_file.filename}"
    with open(file_location, "wb") as file_object:
        file_object.write(audio_file.file.read())
    
    new_voice_embedding = utils.process_audio_file(file_location)
    os.remove(file_location) # Clean up

    if new_voice_embedding is None:
        raise HTTPException(status_code=500, detail="Error processing audio")

    # 4. Decrypt the Stored Voiceprint
    stored_voice_embedding = utils.decrypt_voiceprint(user.voiceprint)

    # 5. Compare Voiceprints (Cosine Similarity)
    similarity = utils.compare_faces(new_voice_embedding, stored_voice_embedding)
    
    # 6. Make a Decision
    # Threshold: 0.75 is a good starting point. 
    # Above 0.75 = Same Person. Below = Imposter.
    THRESHOLD = 0.75
    
    if similarity >= THRESHOLD:
        return {
            "status": "success", 
            "message": "Authentication Successful!", 
            "similarity_score": round(similarity, 4),
            "access_token": "fake-jwt-token-for-demo"
        }
    else:
        raise HTTPException(
            status_code=401, 
            detail=f"Voice verification failed. Similarity: {round(similarity, 4)}"
        )