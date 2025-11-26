import os
import torch
import pydub
from pydub import effects
import numpy as np
import pickle
import bcrypt
import random
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import torchaudio
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]

from speechbrain.inference.separation import SepformerSeparation as SpeechEnhancement
from speechbrain.inference import EncoderClassifier
from transformers import pipeline

# --- SECURE KEY MANAGEMENT ---
def get_encryption_key():
    """Load AES key from environment variable"""
    key_hex = os.getenv("AES_ENCRYPTION_KEY")
    if not key_hex:
        raise ValueError("AES_ENCRYPTION_KEY not set in environment!")
    
    # Convert hex to bytes
    try:
        key = bytes.fromhex(key_hex)
        if len(key) != 32:
            raise ValueError("AES key must be 32 bytes (64 hex characters)")
        return key
    except ValueError as e:
        raise ValueError(f"Invalid AES_ENCRYPTION_KEY format: {e}")

AES_KEY = get_encryption_key()

# --- ENHANCED WORD LIST FOR CHALLENGES ---
WORD_LIST = [
    "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL",
    "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA",
    "QUEBEC", "ROMEO", "SIERRA", "TANGO", "UNIFORM", "VICTOR", "WHISKEY",
    "XRAY", "YANKEE", "ZULU", "NORTH", "SOUTH", "EAST", "WEST",
    "BLUE", "GREEN", "RED", "YELLOW", "PURPLE", "ORANGE", "BLACK", "WHITE",
    "RIVER", "MOUNTAIN", "OCEAN", "FOREST", "SKY", "WIND", "RAIN", "STORM",
    "THUNDER", "CLOUD", "SUN", "MOON", "STAR", "EARTH"
]

# Add numbers to make challenges harder to pre-record
NUMBERS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"]

print("--- LOADING AI MODELS ---")

# 1. Noise Cancellation
print("1. Loading Speech Enhancer...")
enhance_model = SpeechEnhancement.from_hparams(
    source="speechbrain/sepformer-dns4-16k-enhancement",
    savedir="pretrained_models/enhancement"
)

# 2. Anti-Spoofing
print("2. Loading Deepfake Detector...")
spoof_classifier = pipeline("audio-classification", model="MelodyMachine/Deepfake-audio-detection")

# 3. Speaker Verification
print("3. Loading Speaker Encoder...")
spk_model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/verification"
)

# 4. Speech-to-Text
print("4. Loading Text Transcriber...")
transcriber = pipeline("automatic-speech-recognition", model="facebook/wav2vec2-base-960h")

print("--- MODELS LOADED ---")

# --- SECURE PIN LOGIC ---
def hash_pin(pin: str) -> str:
    """Hash PIN with bcrypt"""
    # Input validation
    if not pin or len(pin) < 4 or len(pin) > 12:
        raise ValueError("PIN must be 4-12 characters")
    
    salt = bcrypt.gensalt(rounds=12)  # Increased cost factor
    hashed = bcrypt.hashpw(pin.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Verify PIN with constant-time comparison"""
    try:
        return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))
    except Exception:
        return False

# --- ENHANCED CHALLENGE LOGIC ---
def generate_challenge_code() -> str:
    """Generate random challenge with words and numbers"""
    # 5 words + 2 numbers for better security
    words = random.sample(WORD_LIST, 5)
    numbers = random.sample(NUMBERS, 2)
    
    # Mix them randomly
    combined = words + numbers
    random.shuffle(combined)
    
    return " ".join(combined)

def get_challenge_expiration() -> datetime:
    """Get challenge expiration time from config"""
    expiration_seconds = int(os.getenv("CHALLENGE_EXPIRATION_SECONDS", "300"))
    return datetime.utcnow() + timedelta(seconds=expiration_seconds)

def transcribe_audio(file_path: str) -> str:
    """Convert audio to uppercase text"""
    try:
        # Convert to WAV for compatibility
        wav_path = file_path + "_transcribe.wav"
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(wav_path, format="wav")
        
        # Transcribe
        result = transcriber(wav_path)
        transcript = result['text'].upper()
        
        # Cleanup
        if os.path.exists(wav_path):
            os.remove(wav_path)
        
        return transcript
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

# --- SECURE AUDIO PIPELINE ---
def validate_audio_file(file_size: int) -> bool:
    """Validate audio file size"""
    max_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    max_size_bytes = max_size_mb * 1024 * 1024
    return file_size <= max_size_bytes

def load_and_enhance_audio(file_path: str):
    """Load and enhance audio with validation"""
    try:
        # Validate file exists
        if not os.path.exists(file_path):
            print("Audio file not found")
            return None
        
        # Validate file size
        file_size = os.path.getsize(file_path)
        if not validate_audio_file(file_size):
            print("Audio file too large")
            return None
        
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        # NORMALIZE for consistent volume
        audio = effects.normalize(audio)
        
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        samples = samples / 32768.0
        
        # Silence check
        if np.max(np.abs(samples)) < 0.01:
            print("Audio is silent")
            return None
        
        signal = torch.from_numpy(samples).unsqueeze(0)
        
        # Apply noise cancellation
        est_sources = enhance_model.separate_batch(signal)
        clean_signal = est_sources[:, :, 0]
        
        return clean_signal
    except Exception as e:
        print(f"Error in audio processing: {e}")
        return None

def check_spoofing(file_path: str):
    """Deepfake detection with proper error handling"""
    temp_wav = file_path + "_spoofcheck.wav"
    try:
        # Convert to clean WAV
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(temp_wav, format="wav")
        
        result = spoof_classifier(temp_wav)
        top_result = result[0]
        label = top_result['label'].upper()
        score = top_result['score']
        
        is_real = (label == "REAL")
        
        # Cleanup
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        
        return is_real, score, label
    except Exception as e:
        print(f"Spoof Check Error: {e}")
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        # Fail secure: Reject on error in production
        return False, 0.0, "ERROR"

def get_voice_embedding(signal):
    """Extract voice embedding"""
    embedding = spk_model.encode_batch(signal)
    return embedding.squeeze().cpu().numpy()

# --- ENHANCED ENCRYPTION WITH IV ---
def encrypt_voiceprint(embedding_np: np.ndarray) -> bytes:
    """Encrypt voiceprint with AES-256-GCM"""
    try:
        data_bytes = pickle.dumps(embedding_np)
        
        # Generate random IV
        iv = os.urandom(16)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(AES_KEY),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Encrypt
        ciphertext = encryptor.update(data_bytes) + encryptor.finalize()
        
        # Package: IV + Tag + Ciphertext
        payload = {
            "iv": iv,
            "tag": encryptor.tag,
            "ciphertext": ciphertext
        }
        
        return pickle.dumps(payload)
    except Exception as e:
        print(f"Encryption failed: {e}")
        raise

def decrypt_voiceprint(encrypted_blob: bytes) -> np.ndarray:
    """Decrypt voiceprint with AES-256-GCM"""
    try:
        payload = pickle.loads(encrypted_blob)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(AES_KEY),
            modes.GCM(payload['iv'], payload['tag']),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # Decrypt
        data_bytes = decryptor.update(payload['ciphertext']) + decryptor.finalize()
        
        return pickle.loads(data_bytes)
    except Exception as e:
        print(f"Decryption failed: {e}")
        return None

def compare_faces(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """Compare voice embeddings with cosine similarity"""
    if embedding1 is None or embedding2 is None:
        return 0.0
    
    similarity = np.dot(embedding1, embedding2) / (
        np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
    )
    return float(similarity)

# --- INPUT VALIDATION ---
def validate_username(username: str) -> bool:
    """Validate username format"""
    if not username or len(username) < 3 or len(username) > 50:
        return False
    # Allow alphanumeric and underscore only
    return username.replace('_', '').isalnum()

def validate_pin(pin: str) -> bool:
    """Validate PIN format"""
    if not pin or len(pin) < 4 or len(pin) > 12:
        return False
    # Allow alphanumeric
    return pin.isalnum()