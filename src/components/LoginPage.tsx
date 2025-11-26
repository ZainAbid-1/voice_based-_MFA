import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mic, ArrowLeft, Moon, Sun, Eye, EyeOff, AlertTriangle, Square, RefreshCw } from 'lucide-react';
import Waveform from './Waveform';
import axios from 'axios';

interface LoginPageProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function LoginPage({ darkMode, setDarkMode }: LoginPageProps) {
  const navigate = useNavigate();
  
  // Credentials
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // Flow State
  const [step, setStep] = useState<'credentials' | 'voice'>('credentials');
  const [challengeCode, setChallengeCode] = useState('');
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- STEP 1: GET CHALLENGE ---
  const handleCredentialsSubmit = async () => {
    if (!username || !pin) return;
    setErrorMessage('');
    setIsProcessing(true);

    try {
      // Use explicit 127.0.0.1 to avoid localhost DNS issues
      const response = await axios.get(`http://127.0.0.1:8000/get_challenge/${username}`);
      
      if (response.data && response.data.challenge) {
        setChallengeCode(response.data.challenge);
        setStep('voice');
      } else {
        setErrorMessage("Invalid server response.");
      }
    } catch (error: any) {
      console.error("Challenge Error:", error);
      if (error.response?.status === 404) {
        setErrorMessage("User not found.");
      } else if (error.code === "ERR_NETWORK") {
        setErrorMessage("Could not connect to server. Ensure backend is running.");
      } else {
        setErrorMessage("System error occurred.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STEP 2: RECORDING CONTROLS ---
  const startRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);

    } catch (err) {
      console.error("Mic Error:", err);
      setErrorMessage("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- STEP 3: SUBMIT ---
  const handleLoginSubmit = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('username', username);
    formData.append('pin', pin);
    const file = new File([audioBlob], "login.webm", { type: "audio/webm" });
    formData.append('audio_file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        navigate('/auth-success');
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Authentication failed.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setAudioBlob(null);
    setErrorMessage('');
    startRecording();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Toggles */}
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDarkMode(!darkMode)} className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
      </motion.button>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => navigate('/')} className="absolute top-6 left-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow">
        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl w-full">
        <h1 className="text-center text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          Secure Login
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">Challenge-Response Authentication</p>

        {errorMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 justify-center">
            <AlertTriangle className="w-5 h-5" />
            {errorMessage}
          </motion.div>
        )}

        <motion.div layout className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <AnimatePresence mode="wait">
            
            {/* CREDENTIALS STEP */}
            {step === 'credentials' && (
              <motion.div key="credentials" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" placeholder="Enter username" />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showPin ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value)} className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" placeholder="Enter PIN" />
                    <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCredentialsSubmit} disabled={!username || !pin || isProcessing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg transition-all disabled:opacity-50">
                  {isProcessing ? "Verifying..." : "Get Challenge Code"}
                </motion.button>
              </motion.div>
            )}

            {/* VOICE STEP */}
            {step === 'voice' && (
              <motion.div key="voice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center mb-8">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">Please speak these words clearly:</p>
                  <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                    <p className="text-xl md:text-2xl font-bold font-mono tracking-wide text-blue-700 dark:text-blue-300 leading-relaxed uppercase">
                      {challengeCode}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6">
                  {!audioBlob ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      className="relative"
                    >
                      <motion.div animate={isRecording ? { scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] } : {}} transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }} className="absolute inset-0 bg-blue-500 rounded-full blur-3xl" />
                      <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}>
                        {isRecording ? <Square className="w-10 h-10 text-white fill-current" /> : <Mic className="w-10 h-10 text-white" />}
                      </div>
                    </motion.button>
                  ) : (
                    <div className="flex flex-col items-center">
                       <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-2xl mb-4">
                          <Mic className="w-10 h-10 text-white" />
                       </div>
                       <p className="text-green-600 font-medium">Recording Captured</p>
                    </div>
                  )}
                  
                  <div className="text-center">
                    {isRecording ? (
                      <p className="text-red-500 font-semibold animate-pulse">Recording... Click stop when done</p>
                    ) : audioBlob ? (
                       <div className="flex gap-2 justify-center">
                          <button onClick={handleRetry} className="text-sm text-gray-500 hover:text-gray-700 underline flex items-center gap-1">
                             <RefreshCw className="w-3 h-3"/> Retake
                          </button>
                       </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Click mic to start recording</p>
                    )}
                  </div>
                </div>

                {isRecording && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Waveform isActive={isRecording} />
                  </motion.div>
                )}

                <div className="flex gap-4 pt-4">
                   <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setStep('credentials'); setAudioBlob(null); setUsername(''); setPin(''); }} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl">
                    Cancel
                  </motion.button>
                  
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLoginSubmit} disabled={!audioBlob || isProcessing} className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing ? "Verifying..." : "Verify & Login"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}