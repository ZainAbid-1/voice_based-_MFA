import torchaudio
import torch
import os
import pydub
import numpy as np
import pickle
import bcrypt
from cryptography.fernet import Fernet

# --- CRITICAL FIX: THIS MUST BE BEFORE IMPORTING SPEECHBRAIN ---
# This tricks SpeechBrain into thinking Torchaudio is working fine.
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]
# ---------------------------------------------------------------

# NOW it is safe to import SpeechBrain
from speechbrain.inference import EncoderClassifier

# --- SECURITY CONFIGURATION ---
KEY_FILE = "secret.key"

def load_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as key_file:
            return key_file.read()
    else:
        new_key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as key_file:
            key_file.write(new_key)
        return new_key

key = load_key()
cipher_suite = Fernet(key)

# --- AI MODEL CONFIGURATION ---
spk_model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/spkrec-ecapa-voxceleb"
)

def hash_pin(pin: str) -> str:
    """Hash the PIN using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pin.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Check if the provided PIN matches the hash."""
    return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))

def process_audio_file(file_path: str):
    """
    1. Load audio using pydub.
    2. Convert to 16kHz mono.
    3. Pass data DIRECTLY to SpeechBrain (Bypassing the broken torchaudio.load).
    """
    try:
        # Load audio (pydub uses FFmpeg here)
        audio = pydub.AudioSegment.from_file(file_path)
        
        # Convert to standard format: 16000Hz, Mono (1 channel)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        # --- NEW LOGIC: Convert directly to Tensor ---
        # Get raw audio samples as a numpy array
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        
        # Normalize to range -1.0 to 1.0 (since standard audio is 16-bit integer)
        # 32768 is the max value for 16-bit audio
        samples = samples / 32768.0
        
        # Convert to PyTorch Tensor (Shape: [1, number_of_samples])
        signal = torch.from_numpy(samples).unsqueeze(0)
        # ---------------------------------------------
        
        # Generate Embedding
        embedding = spk_model.encode_batch(signal)
        embedding_np = embedding.squeeze().cpu().numpy()
        
        return embedding_np
        
    except Exception as e:
        print(f"Error processing audio: {e}")
        return None

def encrypt_voiceprint(embedding_np):
    """Encrypt the numpy array (voiceprint) to store in DB."""
    data_bytes = pickle.dumps(embedding_np)
    encrypted_data = cipher_suite.encrypt(data_bytes)
    return encrypted_data

def decrypt_voiceprint(encrypted_data):
    """Decrypt data back to numpy array."""
    decrypted_data = cipher_suite.decrypt(encrypted_data)
    embedding_np = pickle.loads(decrypted_data)
    return embedding_np

def compare_faces(embedding1, embedding2):
    """
    Calculate Cosine Similarity.
    1.0 = Exact Match
    0.0 = No Match
    """
    similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
    return float(similarity)