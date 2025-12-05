import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mic, ArrowLeft, Moon, Sun, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import Waveform from './Waveform';
import axios from 'axios';

interface LoginPageProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function LoginPage({ darkMode, setDarkMode }: LoginPageProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState<'credentials' | 'voice'>('credentials');
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleCredentialsSubmit = () => {
    if (username && pin) {
      setStep('voice');
      setErrorMessage('');
    }
  };

  const handleRecordVoice = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        handleLoginSubmit(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          setIsProcessing(true);
        }
      }, 3500); // 3.5 seconds recording

    } catch (err) {
      console.error("Mic Error:", err);
      setErrorMessage("Microphone access denied.");
    }
  };

  const handleLoginSubmit = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('pin', pin);
    const file = new File([audioBlob], "login.webm", { type: "audio/webm" });
    formData.append('audio_file', file);

    // --- NEW: Send Client Time ---
    const clientTime = new Date().toISOString();
    formData.append('client_time', clientTime);
    // -----------------------------

    try {
      const response = await axios.post('http://127.0.0.1:8000/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        const { token, role } = response.data;
        
        // SAVE TOKEN
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);
        localStorage.setItem('role', role);

        // Redirect based on Role
        if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setIsProcessing(false);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Authentication failed.");
      }
    }
  };

  const handleRetry = () => {
    setIsRecording(false);
    setIsProcessing(false);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <motion.button onClick={() => setDarkMode(!darkMode)} className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg">
        {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
      </motion.button>

      <motion.button onClick={() => navigate('/')} className="absolute top-6 left-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg">
        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl w-full">
        <h1 className="text-center mb-2 text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          Secure Login
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">Voice Biometric Attendance System</p>

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 justify-center">
            <AlertTriangle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <AnimatePresence mode="wait">
            {step === 'credentials' && (
              <motion.div key="credentials" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white" placeholder="Enter username" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showPin ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value)} className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white" placeholder="Enter PIN" />
                    <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleCredentialsSubmit} disabled={!username || !pin} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all disabled:opacity-50">
                  Verify Voice
                </button>
              </motion.div>
            )}

            {step === 'voice' && (
              <motion.div key="voice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
                <p className="text-gray-700 dark:text-gray-300">Speak: <span className="font-bold text-blue-600">"My voice is my password"</span></p>
                <button onClick={handleRecordVoice} disabled={isRecording || isProcessing} className="relative">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}>
                    <Mic className="w-16 h-16 text-white" />
                  </div>
                </button>
                {isRecording && <p className="text-red-500 animate-pulse">Recording...</p>}
                {isProcessing && <p className="text-yellow-500">Processing AI...</p>}
                <div className="flex gap-4 mt-4">
                  <button onClick={handleRetry} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl text-gray-800 dark:text-white">Retry</button>
                  <button onClick={() => setStep('credentials')} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl text-gray-800 dark:text-white">Back</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}