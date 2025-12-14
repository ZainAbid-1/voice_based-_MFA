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
import librosa
from scipy import signal

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
        # Fallback for development if env var not set, or raise error
        # Assuming you have it set based on your previous code
        raise ValueError("AES_ENCRYPTION_KEY not set in environment!")
    
    try:
        key = bytes.fromhex(key_hex)
        if len(key) != 32:
            raise ValueError("AES key must be 32 bytes (64 hex characters)")
        return key
    except ValueError as e:
        raise ValueError(f"Invalid AES_ENCRYPTION_KEY format: {e}")

AES_KEY = get_encryption_key()

# ==========================================
#  NATURAL LANGUAGE CHALLENGE LISTS
# ==========================================

ADJECTIVES = [
    "HAPPY", "QUICK", "BRIGHT", "CALM", "SHARP", "SOFT", "LOUD", "SILENT",
    "GREEN", "BLUE", "RED", "GOLD", "SILVER", "LARGE", "SMALL", "TINY",
    "BRAVE", "WISE", "KIND", "PROUD", "WILD", "TAME", "FRESH", "CLEAN"
]

NOUNS = [
    "TIGER", "EAGLE", "OCEAN", "MOUNTAIN", "RIVER", "FOREST", "GARDEN", "CLOUD",
    "PIANO", "GUITAR", "WINDOW", "DOOR", "SUMMER", "WINTER", "MORNING", "NIGHT",
    "PLAYER", "ARTIST", "DOCTOR", "PILOT", "DRIVER", "BAKER", "TEACHER", "FRIEND"
]

VERBS = [
    "WALKS", "RUNS", "JUMPS", "SLEEPS", "SINGS", "DANCES", "WRITES", "READS",
    "OPENS", "CLOSES", "SMILES", "LAUGHS", "FLYS", "SWIMS", "DRIVES", "COOKS",
    "PAINTS", "BUILDS", "GROWS", "SHINES", "FLOWS", "MOVES", "HELPS", "WORKS"
]

PREPOSITIONS = ["IN", "ON", "AT", "BY", "WITH", "FROM", "OVER", "UNDER"]

# Clock out phrases for voice verification
CLOCK_OUT_PHRASES = [
    "I AM COMPLETING MY SHIFT NOW",
    "I CONFIRM CLOCK OUT AUTHORIZATION",
    "MY WORK DAY IS COMPLETE",
    "I VERIFY MY DEPARTURE TIME"
]

print("=" * 60)
print("🔧 INITIALIZING AI MODELS")
print("=" * 60)

# 1. Noise Cancellation
print("📡 [1/4] Loading Speech Enhancement Model...")
enhance_model = SpeechEnhancement.from_hparams(
    source="speechbrain/sepformer-dns4-16k-enhancement",
    savedir="pretrained_models/enhancement"
)
print("✅ Speech Enhancement Ready")

# 2. Anti-Spoofing
print("🛡️  [2/4] Loading Deepfake Detection Model...")
spoof_classifier = pipeline("audio-classification", model="MelodyMachine/Deepfake-audio-detection")
print("✅ Deepfake Detector Ready")

# 3. Speaker Verification
print("🎤 [3/4] Loading Speaker Verification Model...")
spk_model = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="pretrained_models/verification"
)
print("✅ Speaker Encoder Ready")

# 4. Speech-to-Text
print("📝 [4/4] Loading Speech Recognition Model...")
transcriber = pipeline("automatic-speech-recognition", model="facebook/wav2vec2-base-960h")
print("✅ Transcription Ready")

print("=" * 60)
print("✨ ALL MODELS LOADED SUCCESSFULLY")
print("=" * 60)
print()

# --- AUDIO QUALITY VALIDATION ---
def calculate_snr(audio_data, sample_rate=16000):
    """Calculate Signal-to-Noise Ratio"""
    try:
        # Calculate RMS of signal
        rms_signal = np.sqrt(np.mean(audio_data ** 2))
        
        # Estimate noise from quietest 10% of signal
        sorted_abs = np.sort(np.abs(audio_data))
        noise_samples = sorted_abs[:len(sorted_abs) // 10]
        rms_noise = np.sqrt(np.mean(noise_samples ** 2))
        
        if rms_noise == 0:
            return 100.0  # Very clean signal
        
        snr_db = 20 * np.log10(rms_signal / rms_noise)
        return float(snr_db)
    except:
        return 0.0

def detect_multiple_speakers(audio_data, sample_rate=16000):
    """Detect if multiple people are speaking"""
    try:
        # Calculate spectral flux (indicates speaker changes)
        stft = np.abs(librosa.stft(audio_data))
        spectral_flux = np.sum(np.diff(stft, axis=1) ** 2, axis=0)
        
        # High variance indicates multiple speakers
        flux_variance = np.var(spectral_flux)
        
        # Calculate zero crossing rate variation
        zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
        zcr_variance = np.var(zcr)
        
        # Threshold-based detection
        multiple_speakers = flux_variance > 1000 or zcr_variance > 0.01
        
        return multiple_speakers, flux_variance
    except:
        return False, 0.0

def check_audio_quality(file_path: str):
    """
    Relaxed audio quality check.
    It warns about issues but allows the process to continue unless audio is silent.
    """
    try:
        print(f"\n{'=' * 60}")
        print(f"🔍 AUDIO QUALITY ANALYSIS (RELAXED MODE)")
        print(f"{'=' * 60}")
        
        # Load audio
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        
        # 1. Check for Silence (The only hard reject)
        if len(samples) == 0 or np.max(np.abs(samples)) == 0:
             print("❌ Audio is empty or silent")
             return False, 0.0, False, False, {}

        # Normalize for calculation
        samples = samples / 32768.0
        
        # 1. Volume Check
        rms = np.sqrt(np.mean(samples ** 2))
        db_level = 20 * np.log10(rms + 1e-10)
        print(f"📊 Volume Level: {db_level:.2f} dB")
        
        is_too_loud = db_level > -1.0  # Only flag if hitting absolute max
        is_too_quiet = db_level < -60.0
        
        # 2. SNR Check
        snr = calculate_snr(samples)
        print(f"📡 Signal-to-Noise Ratio: {snr:.2f} dB")
        
        # 3. Multiple Speaker Detection (RELAXED)
        # We increase threshold significantly to ignore clipping distortion
        multiple_speakers, flux = detect_multiple_speakers(samples)
        
        # Override speaker detection if volume is clipping (Distortion looks like multiple speakers)
        if is_too_loud:
            print("⚠️ Clipping detected - Ignoring Speaker Detection (likely false positive)")
            multiple_speakers = False

        print(f"👥 Speaker Detection: {'Multiple speakers detected' if multiple_speakers else 'Single speaker'}")
        print(f"📈 Spectral Flux Variance: {flux:.2f}")
        
        print(f"{'=' * 60}\n")
        
        # LOGIC CHANGE: We return True (Valid) even if audio is loud/noisy.
        # We rely on the AI models to handle the cleanup.
        is_good_quality = True 
        
        details = {
            "db_level": db_level,
            "snr": snr,
            "is_too_loud": is_too_loud,
            "is_too_quiet": is_too_quiet,
            "multiple_speakers": multiple_speakers,
            "flux_variance": flux
        }
        
        return is_good_quality, snr, is_too_loud, multiple_speakers, details
        
    except Exception as e:
        print(f"❌ Audio quality check failed: {e}")
        # Default to True to let the process try anyway
        return True, 0.0, False, False, {}

# --- SECURE PIN LOGIC ---
def hash_pin(pin: str) -> str:
    """Hash PIN with bcrypt"""
    if not pin or len(pin) < 4 or len(pin) > 12:
        raise ValueError("PIN must be 4-12 characters")
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pin.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Verify PIN with constant-time comparison"""
    try:
        return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))
    except Exception:
        return False

# --- CHALLENGE GENERATION ---
def generate_challenge_code() -> str:
    """
    Generate a natural sounding sentence structure:
    Format: [ADJECTIVE] [NOUN] [VERB] [PREPOSITION] [NUMBER]
    """
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    verb = random.choice(VERBS)
    prep = random.choice(PREPOSITIONS)
    num = random.randint(10, 99)
    
    challenge = f"{adj} {noun} {verb} {prep} {num}"
    return challenge

def generate_clock_out_phrase() -> str:
    """Generate clock out verification phrase"""
    return random.choice(CLOCK_OUT_PHRASES)

def get_challenge_expiration() -> datetime:
    expiration_seconds = int(os.getenv("CHALLENGE_EXPIRATION_SECONDS", "300"))
    return datetime.utcnow() + timedelta(seconds=expiration_seconds)

def transcribe_audio(file_path: str) -> str:
    """Convert audio to uppercase text"""
    try:
        wav_path = file_path + "_transcribe.wav"
        audio = pydub.AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(wav_path, format="wav")
        
        result = transcriber(wav_path)
        transcript = result['text'].upper()
        
        if os.path.exists(wav_path):
            os.remove(wav_path)
        
        return transcript
    except Exception as e:
        print(f"❌ Transcription error: {e}")
        return ""

# --- SECURE AUDIO PIPELINE ---
def validate_audio_file(file_size: int) -> bool:
    max_size_mb = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    max_size_bytes = max_size_mb * 1024 * 1024
    return file_size <= max_size_bytes

def load_and_enhance_audio(file_path: str):
    """Enhanced audio processing with SAFE normalization"""
    try:
        if not os.path.exists(file_path):
            print("❌ Audio file not found")
            return None
        
        file_size = os.path.getsize(file_path)
        if not validate_audio_file(file_size):
            print("❌ Audio file too large")
            return None
        
        # 1. Load Audio
        audio = pydub.AudioSegment.from_file(file_path)
        
        # --- FIX: SAFE NORMALIZATION (-3.0 dB) ---
        # Replaced effects.normalize(audio) with manual gain.
        # This prevents the audio from hitting 0dB and causing clipping.
        target_dBFS = -3.0
        change_in_dBFS = target_dBFS - audio.max_dBFS
        audio = audio.apply_gain(change_in_dBFS)
        # -----------------------------------------
        
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        samples = samples / 32768.0
        
        if np.max(np.abs(samples)) < 0.01:
            print("❌ Audio is silent")
            return None
        
        # Enhance audio
        signal_tensor = torch.from_numpy(samples).unsqueeze(0)
        est_sources = enhance_model.separate_batch(signal_tensor)
        clean_signal = est_sources[:, :, 0]
        
        print("✅ Audio enhancement complete (Safe Norm Applied)")
        return clean_signal
        
    except Exception as e:
        print(f"❌ Error in audio processing: {e}")
        return None

def detect_playback_artifacts(file_path: str):
    """Detect artifacts typical of recorded/replayed audio"""
    try:
        y, sr = librosa.load(file_path, sr=16000)
        
        # 1. Check for low-frequency rumble (speakers often introduce this)
        low_freq_energy = np.sum(np.abs(librosa.stft(y, n_fft=2048)[:20, :]))
        total_energy = np.sum(np.abs(librosa.stft(y, n_fft=2048)))
        low_freq_ratio = low_freq_energy / (total_energy + 1e-10)
        
        # 2. Check for missing high frequencies (compression artifacts)
        high_freq_energy = np.sum(np.abs(librosa.stft(y, n_fft=2048)[-100:, :]))
        high_freq_ratio = high_freq_energy / (total_energy + 1e-10)
        
        # 3. Check spectral flatness (replayed audio tends to be flatter)
        spectral_flatness = np.mean(librosa.feature.spectral_flatness(y=y))
        
        # Scoring system
        playback_score = 0.0
        reasons = []
        
        if low_freq_ratio > 0.15:
            playback_score += 0.4
            reasons.append(f"Excessive low-frequency energy ({low_freq_ratio:.3f})")
        
        if high_freq_ratio < 0.05:
            playback_score += 0.3
            reasons.append(f"Missing high frequencies ({high_freq_ratio:.3f})")
        
        if spectral_flatness > 0.3:
            playback_score += 0.3
            reasons.append(f"Abnormal spectral flatness ({spectral_flatness:.3f})")
        
        is_playback = playback_score >= 0.6
        
        print(f"🔬 Playback Artifact Analysis:")
        print(f"   Low-freq ratio: {low_freq_ratio:.3f} (threshold: 0.15)")
        print(f"   High-freq ratio: {high_freq_ratio:.3f} (threshold: 0.05)")
        print(f"   Spectral flatness: {spectral_flatness:.3f} (threshold: 0.3)")
        print(f"   Playback score: {playback_score:.2f}/1.0")
        
        if is_playback:
            print(f"⚠️  Playback indicators: {', '.join(reasons)}")
        
        return is_playback, playback_score, reasons
        
    except Exception as e:
        print(f"⚠️  Playback artifact detection failed: {e}")
        return False, 0.0, []

def check_spoofing(file_path: str, is_clipped: bool = False):
    """Anti-spoofing detection with clipping detection and playback artifact analysis"""
    
    if os.getenv("SKIP_SPOOF_CHECK") == "true":
        print(f"⚠️  SPOOF CHECK BYPASSED (Development Mode)")
        return True, 1.0, "REAL"
    
    temp_wav = file_path + "_spoofcheck.wav"
    try:
        print(f"\n🛡️  Running Multi-Layer Anti-Spoofing Analysis...")
        
        # Load audio
        audio = pydub.AudioSegment.from_file(file_path)
        
        # --- FIX: SAFE NORMALIZATION FOR SPOOF CHECK ---
        # We also normalize the audio for the spoof checker so loud users
        # don't get flagged as fake due to distortion.
        target_dBFS = -3.0
        change_in_dBFS = target_dBFS - audio.max_dBFS
        audio = audio.apply_gain(change_in_dBFS)
        # -----------------------------------------------

        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(temp_wav, format="wav")
        
        # Layer 1: AI-based deepfake detection
        result = spoof_classifier(temp_wav)
        top_result = result[0]
        label = top_result['label'].upper()
        score = top_result['score']
        
        print(f"🔍 AI Deepfake Detection: {label} (confidence: {score:.4f})")
        
        # Layer 2: Playback artifact detection
        is_playback, playback_score, reasons = detect_playback_artifacts(temp_wav)
        
        # Combined decision
        is_real = (label == "REAL") and not is_playback
        
        if label == "REAL" and is_playback:
            print(f"❌ AI classified as REAL, but playback artifacts detected!")
            label = "PLAYBACK"
        elif label != "REAL":
            print(f"❌ AI detected synthetic audio")
        else:
            print(f"✅ Audio verified as GENUINE (passed both checks)")
        
        if not is_real:
            if is_clipped and label == "PLAYBACK":
                label = "QUALITY_ISSUE"
                print(f"⚠️  Could be quality issue - please lower voice volume")
            elif label == "PLAYBACK":
                print(f"❌ PLAYBACK DETECTED - Audio rejected")
                print(f"   Reasons: {', '.join(reasons) if reasons else 'Artifact analysis'}")
            else:
                print(f"❌ SPOOFING DETECTED - Audio rejected")
        
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        
        return is_real, score, label
        
    except Exception as e:
        print(f"❌ Spoof Check Error: {e}")
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        return False, 0.0, "ERROR"

def get_voice_embedding(signal):
    """Generate voice embedding"""
    print(f"🎤 Generating voice embedding...")
    embedding = spk_model.encode_batch(signal)
    print(f"✅ Voice embedding created (dimension: {embedding.shape})")
    return embedding.squeeze().cpu().numpy()

# --- ENCRYPTION LOGIC ---
def encrypt_voiceprint(embedding_np: np.ndarray) -> bytes:
    try:
        data_bytes = pickle.dumps(embedding_np)
        iv = os.urandom(16)
        cipher = Cipher(algorithms.AES(AES_KEY), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(data_bytes) + encryptor.finalize()
        payload = {"iv": iv, "tag": encryptor.tag, "ciphertext": ciphertext}
        print(f"🔒 Voiceprint encrypted successfully")
        return pickle.dumps(payload)
    except Exception as e:
        print(f"❌ Encryption failed: {e}")
        raise

def decrypt_voiceprint(encrypted_blob: bytes) -> np.ndarray:
    try:
        payload = pickle.loads(encrypted_blob)
        cipher = Cipher(algorithms.AES(AES_KEY), modes.GCM(payload['iv'], payload['tag']), backend=default_backend())
        decryptor = cipher.decryptor()
        data_bytes = decryptor.update(payload['ciphertext']) + decryptor.finalize()
        print(f"🔓 Voiceprint decrypted successfully")
        return pickle.loads(data_bytes)
    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        return None

def compare_faces(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """Compare voice embeddings with detailed logging"""
    if embedding1 is None or embedding2 is None:
        print(f"❌ Cannot compare - one or both embeddings are None")
        return 0.0
    
    similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
    similarity_score = float(similarity)
    
    print(f"\n{'=' * 60}")
    print(f"🔍 VOICE VERIFICATION ANALYSIS")
    print(f"{'=' * 60}")
    print(f"📊 Similarity Score: {similarity_score:.4f}")
    print(f"🎯 Threshold: 0.5000")
    
    if similarity_score >= 0.50:
        print(f"✅ MATCH - Voice verified successfully")
    else:
        print(f"❌ MISMATCH - Voice verification failed")
    
    print(f"{'=' * 60}\n")
    
    return similarity_score

# --- VALIDATION ---
def validate_username(username: str) -> bool:
    if not username or len(username) < 3 or len(username) > 50:
        return False
    return username.replace('_', '').isalnum()

def validate_pin(pin: str) -> bool:
    if not pin or len(pin) < 4 or len(pin) > 12:
        return False
    return pin.isalnum()