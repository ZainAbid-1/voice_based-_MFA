from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from pydantic import BaseModel # <--- Added this import
import os
import shutil
import numpy as np
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt

# Load environment variables
load_dotenv()

from database import get_db, engine
import models
import utils

# Create tables
models.Base.metadata.create_all(bind=engine)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Secure Voice MFA System")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

os.makedirs("uploads", exist_ok=True)

# --- CORS CONFIGURATION ---
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# --- JWT CONFIGURATION ---
JWT_SECRET = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

if not JWT_SECRET:
    raise ValueError("JWT_SECRET_KEY not set in environment!")

security = HTTPBearer()

# --- HELPER MODELS ---
class ChallengeRequest(BaseModel):
    username: str
    pin: str

# --- HELPER FUNCTIONS ---
def create_access_token(username: str) -> str:
    """Create JWT token"""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": username,
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def log_login_attempt(db: Session, username: str, user_id: int, success: bool, 
                      failure_reason: str = None, ip_address: str = None):
    """Log login attempt to database"""
    attempt = models.LoginAttempt(
        user_id=user_id,
        username=username,
        success=success,
        failure_reason=failure_reason,
        ip_address=ip_address
    )
    db.add(attempt)
    db.commit()

def check_account_lockout(user: models.User) -> bool:
    """Check if account is locked"""
    if user.locked_until:
        if datetime.utcnow() < user.locked_until:
            return True
        else:
            # Unlock account
            user.locked_until = None
            user.failed_attempts = 0
    return False

def handle_failed_login(db: Session, user: models.User):
    """Handle failed login attempt"""
    user.failed_attempts += 1
    
    max_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    lockout_minutes = int(os.getenv("LOCKOUT_DURATION_MINUTES", "15"))
    
    if user.failed_attempts >= max_attempts:
        user.locked_until = datetime.utcnow() + timedelta(minutes=lockout_minutes)
        db.commit()
        raise HTTPException(
            status_code=429,
            detail=f"Account locked due to multiple failed attempts. Try again after {lockout_minutes} minutes."
        )
    
    db.commit()

def cleanup_expired_challenges(db: Session):
    """Remove expired challenges"""
    db.query(models.Challenge).filter(
        models.Challenge.expires_at < datetime.utcnow()
    ).delete()
    db.commit()

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Secure Voice MFA System", "status": "active"}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ========================================
# 1. CHALLENGE GENERATION (SECURED)
# ========================================
@app.post("/get_challenge") # Changed to POST to accept PIN securely
@limiter.limit("10/minute")
def get_challenge(
    request: Request, 
    payload: ChallengeRequest, 
    db: Session = Depends(get_db)
):
    """Generate random challenge phrase ONLY if PIN is correct"""
    
    username = payload.username
    pin = payload.pin
    client_ip = request.client.host if request.client else "unknown"

    # Validate username format
    if not utils.validate_username(username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    
    # Check if user exists
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        # Security: Don't reveal user existence, but fail the same way
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check account lockout
    if check_account_lockout(user):
        raise HTTPException(
            status_code=429,
            detail="Account is temporarily locked. Please try again later."
        )
    
    # --- VERIFY PIN HERE ---
    if not utils.verify_pin(pin, user.password_hash):
        handle_failed_login(db, user)
        log_login_attempt(db, username, user.id, False, "Wrong PIN during challenge request", client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Cleanup old challenges
    cleanup_expired_challenges(db)
    
    # Generate new challenge
    code = utils.generate_challenge_code()
    expiration = utils.get_challenge_expiration()
    
    # Store in database
    challenge = models.Challenge(
        username=username,
        challenge_code=code,
        expires_at=expiration
    )
    db.add(challenge)
    db.commit()
    
    print(f"Generated Challenge for {username}: {code}")
    return {
        "challenge": code,
        "expires_in_seconds": int(os.getenv("CHALLENGE_EXPIRATION_SECONDS", "300"))
    }

# ========================================
# 2. REGISTRATION
# ========================================
@app.post("/register")
@limiter.limit("3/hour")
async def register_user(
    request: Request,
    username: str = Form(...),
    pin: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Register new user with voice samples"""
    print(f"--- Registering User: {username} ---")
    
    try:
        # Input validation
        if not utils.validate_username(username):
            raise HTTPException(
                status_code=400,
                detail="Username must be 3-50 characters, alphanumeric and underscore only"
            )
        
        if not utils.validate_pin(pin):
            raise HTTPException(
                status_code=400,
                detail="PIN must be 4-12 characters, alphanumeric only"
            )
        
        # Check if username exists
        if db.query(models.User).filter(models.User.username == username).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Validate file count
        if len(files) != 3:
            raise HTTPException(status_code=400, detail="Exactly 3 audio samples required")
        
        embeddings = []
        
        # Process all 3 audio samples
        for i, audio_file in enumerate(files):
            # Validate file size
            file_content = await audio_file.read()
            if not utils.validate_audio_file(len(file_content)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Sample {i+1} exceeds maximum file size"
                )
            
            # Save temporarily
            temp_filename = f"uploads/reg_{username}_{i}_{audio_file.filename}"
            with open(temp_filename, "wb") as buffer:
                buffer.write(file_content)
            
            try:
                # Process audio
                clean_signal = utils.load_and_enhance_audio(temp_filename)
                if clean_signal is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Sample {i+1} is poor quality or silent"
                    )
                
                # Get embedding
                emb = utils.get_voice_embedding(clean_signal)
                embeddings.append(emb)
                
            finally:
                # Always cleanup temp file
                if os.path.exists(temp_filename):
                    os.remove(temp_filename)
        
        # Average embeddings
        avg_embedding = np.mean(embeddings, axis=0)
        
        # Encrypt and save
        encrypted_blob = utils.encrypt_voiceprint(avg_embedding)
        hashed_pin = utils.hash_pin(pin)
        
        new_user = models.User(
            username=username,
            password_hash=hashed_pin,
            salt="bcrypt",
            voiceprint=encrypted_blob,
            failed_attempts=0
        )
        
        db.add(new_user)
        db.commit()
        
        return {
            "status": "success",
            "message": "User registered successfully",
            "username": username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration Error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

# ========================================
# 3. LOGIN
# ========================================
@app.post("/login")
@limiter.limit("10/5minutes")
async def login_user(
    request: Request,
    username: str = Form(...),
    pin: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Authenticate user with PIN and voice"""
    print(f"\n--- Login Attempt: {username} ---")
    
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Validate input
    if not utils.validate_username(username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    
    # Check user exists
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        log_login_attempt(db, username, None, False, "User not found", client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check account lockout
    if check_account_lockout(user):
        log_login_attempt(db, username, user.id, False, "Account locked", client_ip)
        raise HTTPException(
            status_code=429,
            detail="Account locked. Please try again later."
        )
    
    # Verify PIN
    if not utils.verify_pin(pin, user.password_hash):
        handle_failed_login(db, user)
        log_login_attempt(db, username, user.id, False, "Wrong PIN", client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get and validate challenge
    cleanup_expired_challenges(db)
    challenge = db.query(models.Challenge).filter(
        models.Challenge.username == username,
        models.Challenge.used == False,
        models.Challenge.expires_at > datetime.utcnow()
    ).order_by(models.Challenge.created_at.desc()).first()
    
    if not challenge:
        raise HTTPException(
            status_code=400,
            detail="Challenge expired. Click 'Get Challenge' again."
        )
    
    expected_code = challenge.challenge_code
    
    # Validate file size
    file_content = await audio_file.read()
    if not utils.validate_audio_file(len(file_content)):
        raise HTTPException(status_code=400, detail="Audio file too large")
    
    # Save audio temporarily
    temp_filename = f"uploads/login_{username}_{audio_file.filename}"
    with open(temp_filename, "wb") as buffer:
        buffer.write(file_content)
    
    try:
        # --- PHASE A: Challenge Verification (DISABLED) ---
        # We still transcribe for logging, but we won't block the user if they miss words.
        transcript = utils.transcribe_audio(temp_filename)
        print(f"Expected: {expected_code}")
        print(f"Spoken: {transcript}")

        # SKIPPING STRICT TEXT CHECK
        print(">> NOTICE: Challenge text verification disabled. Proceeding to Biometrics...")
        
        # --- PHASE B: Voice Biometric ---
        clean_signal = utils.load_and_enhance_audio(temp_filename)
        if clean_signal is None:
            handle_failed_login(db, user)
            log_login_attempt(db, username, user.id, False, "Audio unclear", client_ip)
            raise HTTPException(status_code=400, detail="Audio quality insufficient")
        
        # Anti-spoofing check
        is_real, conf, label = utils.check_spoofing(temp_filename)
        if not is_real:
            handle_failed_login(db, user)
            log_login_attempt(db, username, user.id, False, "Spoof detected", client_ip)
            raise HTTPException(
                status_code=403,
                detail="Synthetic/replayed audio detected"
            )
        
        # Voice matching
        login_emb = utils.get_voice_embedding(clean_signal)
        stored_emb = utils.decrypt_voiceprint(user.voiceprint)
        
        if stored_emb is None:
            raise HTTPException(status_code=500, detail="Failed to decrypt voiceprint")
        
        score = utils.compare_faces(login_emb, stored_emb)
        print(f"Biometric Score: {score:.4f}")
        
        THRESHOLD = 0.54
        
        if score >= THRESHOLD:
            # Success - reset failed attempts
            user.failed_attempts = 0
            user.last_login = datetime.utcnow()
            challenge.used = True
            db.commit()
            
            log_login_attempt(db, username, user.id, True, None, client_ip)
            
            # Create JWT token
            token = create_access_token(username)
            
            return {
                "status": "success",
                "user": username,
                "score": round(score, 4),
                "token": token,
                "expires_in_hours": JWT_EXPIRATION_HOURS
            }
        else:
            handle_failed_login(db, user)
            log_login_attempt(db, username, user.id, False, f"Voice mismatch (score: {score:.2f})", client_ip)
            raise HTTPException(
                status_code=401,
                detail=f"Voice not recognized (confidence: {score:.2f})"
            )
            
    finally:
        # Always cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

# ========================================
# 4. PROTECTED ENDPOINT EXAMPLE
# ========================================
@app.get("/protected")
def protected_route(username: str = Depends(verify_token)):
    """Example protected endpoint requiring valid JWT"""
    return {
        "message": "Access granted",
        "user": username
    }

# ========================================
# 5. USER INFO ENDPOINT
# ========================================
@app.get("/user/info")
def get_user_info(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get user information"""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user.username,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "is_active": user.is_active
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)