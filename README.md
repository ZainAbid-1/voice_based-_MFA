# 🎙️ Voice-Based Multi-Factor Authentication (MFA)

> **Secure. Biometric. Modern.**

A full-stack authentication system that combines traditional credentials (PIN) with AI-powered Voice Biometrics. This project utilizes Deep Learning to generate unique voice embeddings, verifying users based on *who they are*, not just *what they know*.

---

## 🚀 Features

- **Multi-Factor Authentication:** Requires both a PIN and a matching Voice Sample to log in.
- **AI-Powered Recognition:** Uses **SpeechBrain** (ECAPA-TDNN model) to extract high-fidelity speaker embeddings.
- **Bank-Grade Security:**
  - **PINs:** Hashed using `bcrypt` (Salted & Hashed).
  - **Voiceprints:** Encrypted using `Fernet` (AES-256) before storage.
- **Robust Audio Processing:** Handles cross-platform audio formats (WebM to WAV conversion) using `FFmpeg` and `Pydub`.
- **Modern Frontend:** Built with **React (TypeScript)**, featuring Dark Mode, Framer Motion animations, and real-time waveform visualization.
- **Database:** Persistent storage using **MySQL**.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion (Framer Motion)
- **HTTP Client:** Axios
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn
- **Database ORM:** SQLAlchemy
- **Database:** MySQL
- **Audio Processing:** Pydub, FFmpeg, NumPy
- **Machine Learning:** PyTorch, SpeechBrain

---

## ⚙️ Prerequisites

Before running the project, ensure you have the following installed:

1.  **Python 3.9+**
2.  **Node.js & npm**
3.  **MySQL Server** (Running locally)
4.  **FFmpeg** (Must be added to your System PATH)
    *   *Windows users: Download FFmpeg, extract it, and add the `bin` folder to your Environment Variables.*

---

## 📦 Installation & Setup

### 1. Database Setup
1.  Open **MySQL Workbench**.
2.  Run the following SQL command to create the database:
    ```sql
    CREATE DATABASE voice_mfa;
    ```

### 2. Backend Setup
Navigate to the `backend` folder:

```bash
cd backend
Create and activate a virtual environment:
code
Bash
# Windows
python -m venv venv
venv\Scripts\activate
Install dependencies:
code
Bash
pip install -r requirements.txt
Configuration:
Open backend/database.py and update the connection string with your MySQL credentials.
Note: If your password contains @, replace it with %40.
code
Python
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:YOUR_PASSWORD@localhost/voice_mfa"
Run the Server:
code
Bash
uvicorn main:app --reload
The server will start on http://127.0.0.1:8000. On the first run, it will download the AI models (approx 500MB).
3. Frontend Setup
Open a new terminal and navigate to the frontend folder:
code
Bash
cd frontend
Install dependencies:
code
Bash
npm install
Run the development server:
code
Bash
npm run dev
The app will open at http://localhost:5173 (or similar).
🧪 How to Test
Phase 1: Enrollment (Registration)
Go to the Register page.
Enter a Username and a PIN.
Click the Microphone button and say the phrase: "My voice is my password".
Submit.
Backend Action: The audio is converted to 16kHz WAV -> AI extracts vector -> Vector is Encrypted -> Saved to MySQL.
Phase 2: Authentication (Login)
Go to the Login page.
Enter the same Username and PIN.
Record your voice saying the phrase again.
Result:
Success: If the PIN matches AND the voice similarity score is > 0.75.
Failure: If the PIN is wrong OR the voice does not match.
🧠 Architecture Overview
Audio Capture: The browser records audio as a .webm blob.
Preprocessing: FastAPI receives the blob. Pydub converts it to a standard 16kHz Mono WAV file (bypassing Windows TorchCodec issues).
Embedding Extraction: The audio tensor is passed to SpeechBrain's ECAPA-TDNN model, which outputs a 192-dimensional vector (the "Voiceprint").
Comparison: During login, Cosine Similarity is calculated between the live voiceprint and the decrypted stored voiceprint.
code
Python
# Cosine Similarity Formula
similarity = (A . B) / (||A|| * ||B||)
🔧 Troubleshooting
Error: TorchCodec is required / torchaudio.load failed:
This project uses a custom utils.py implementation that uses pydub and numpy to bypass torchaudio's strict dependency on Windows. Ensure you are using the provided utils.py.
Error: FileNotFoundError (WinError 2):
FFmpeg is not in your System Path. Install FFmpeg and restart your terminal.
Database Connection Failed:
Check if MySQL Service is running in Services.msc.
Ensure your password in database.py is URL encoded (e.g., %40 instead of @).
Privilege Error (WinError 1314):
Run your terminal/IDE as Administrator or enable "Developer Mode" in Windows settings to allow the AI model to create symbolic links.
📜 License
This project is open-source and available under the MIT License.