import os

# --- CRITICAL FIX: FORCE DOWNLOADS TO E: DRIVE ---
# This must run BEFORE any other imports to save space on C:
os.environ["HF_HOME"] = "E:/hf_cache"
os.environ["TORCH_HOME"] = "E:/hf_cache"
# -------------------------------------------------

import torchaudio
import torch
import pydub
import numpy as np
import pickle
import bcrypt
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

# --- FIX TORCHAUDIO BACKEND ISSUES ---
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]

from speechbrain.inference import EncoderClassifier
from speechbrain.inference.separation import SepformerSeparation as SpeechEnhancement
from transformers import pipeline

# --- SECURITY CONFIGURATION (AES-256) ---
KEY_FILE = "secret.key"

def load_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as key_file:
            key = key_file.read()
            if len(key) != 32:
                os.rename(KEY_FILE, "secret.key.bak")
                return load_key()
            return key
    else:
        new_key = get_random_bytes(32)
        with open(KEY_FILE, "wb") as key_file:
            key_file.write(new_key)
        return new_key

AES_KEY = load_key()

# --- AI MODEL LOADING ---
print("--- LOADING AI MODELS ---")

# 1. Noise Cancellation (Gate 0)
print("1. Loading Speech Enhancer...")
enhance_model = SpeechEnhancement.from_hparams(
    source="speechbrain/sepformer-dns4-16k-enhancement",
    savedir="pretrained_models/enhancement"
)

# 2. Anti-Spoofing (Gate 1)
print("2. Loading Deepfake Detector...")
spoof_classifier = pipeline("audio-classification", model="MelodyMachine/Deepfake-audio-detection")

# 3. Speaker Verification (Gate 2)
print("3. Loading Speaker Encoder...")
spk_model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/verification"
)
print("--- MODELS LOADED ---")

# --- PIN LOGIC ---
def hash_pin(pin: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pin.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))

# --- AUDIO PIPELINE ---

def load_and_enhance_audio(file_path: str):
    try:
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        samples = samples / 32768.0
        
        signal = torch.from_numpy(samples).unsqueeze(0)

        # Apply Noise Cancellation
        est_sources = enhance_model.separate_batch(signal)
        clean_signal = est_sources[:, :, 0] 
        
        return clean_signal
    except Exception as e:
        print(f"Error in audio processing: {e}")
        return None

def check_spoofing(file_path):
    """
    Gate 1: Deepfake Detection.
    Returns: (is_real: bool, confidence: float, label: str)
    """
    try:
        # The pipeline expects a file path
        result = spoof_classifier(file_path)
        
        # Result format: [{'score': 0.95, 'label': 'REAL'}, ...]
        top_result = result[0]
        label = top_result['label'].upper() # Ensure uppercase
        score = top_result['score']
        
        # Logic: Check if it thinks it's REAL
        is_real = (label == "REAL")
        
        return is_real, score, label
    except Exception as e:
        print(f"Spoof Check Error: {e}")
        # Fail safe: If detector errors out, we treat it as suspicious
        return False, 0.0, "ERROR"

def get_voice_embedding(signal):
    embedding = spk_model.encode_batch(signal)
    return embedding.squeeze().cpu().numpy()

# --- ENCRYPTION LOGIC ---

def encrypt_voiceprint(embedding_np):
    data_bytes = pickle.dumps(embedding_np)
    cipher = AES.new(AES_KEY, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(data_bytes)
    
    payload = {"nonce": cipher.nonce, "tag": tag, "ciphertext": ciphertext}
    return pickle.dumps(payload)

def decrypt_voiceprint(encrypted_blob):
    try:
        payload = pickle.loads(encrypted_blob)
        cipher = AES.new(AES_KEY, AES.MODE_GCM, nonce=payload['nonce'])
        data_bytes = cipher.decrypt_and_verify(payload['ciphertext'], payload['tag'])
        return pickle.loads(data_bytes)
    except Exception as e:
        print(f"Decryption failed: {e}")
        return None

def compare_faces(embedding1, embedding2):
    if embedding1 is None or embedding2 is None: return 0.0
    similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
    return float(similarity)