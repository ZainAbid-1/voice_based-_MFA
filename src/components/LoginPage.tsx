import { useState, useRef, useEffect } from 'react';
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
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!lockedUntil) {
      setRemainingTime('');
      return;
    }

    const updateRemainingTime = () => {
      const now = new Date();
      const lockTime = new Date(lockedUntil);
      const diff = lockTime.getTime() - now.getTime();

      if (diff <= 0) {
        setLockedUntil(null);
        setRemainingTime('');
        setErrorMessage('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const lockTimeLocal = lockTime.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });

      if (hours > 0) {
        setRemainingTime(`Account locked until ${lockTimeLocal} (${hours}h ${minutes}m ${seconds}s remaining)`);
      } else if (minutes > 0) {
        setRemainingTime(`Account locked until ${lockTimeLocal} (${minutes}m ${seconds}s remaining)`);
      } else {
        setRemainingTime(`Account locked until ${lockTimeLocal} (${seconds}s remaining)`);
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  // --- STEP 1: GET CHALLENGE (UPDATED TO POST) ---
  const handleCredentialsSubmit = async () => {
    if (!username || !pin) return;

    setErrorMessage('');
    setIsProcessing(true);

    try {
      // CHANGED: Using POST with username AND pin
      const response = await axios.post('http://127.0.0.1:8000/get_challenge', {
        username: username,
        pin: pin
      });

      if (response.data && response.data.challenge) {
        setChallengeCode(response.data.challenge);
        setStep('voice');
      } else {
        setErrorMessage("Invalid server response.");
      }
    } catch (error: any) {
      console.error("Challenge Error:", error);
      if (error.response?.status === 403) {
        const detail = error.response?.data?.detail || "";
        const parts = detail.split("|");
        if (parts.length === 2) {
          setLockedUntil(parts[1]);
          setErrorMessage(parts[0]);
        } else {
          setErrorMessage(detail);
        }
      } else if (error.response?.status === 401) {
        setErrorMessage("Invalid Username or PIN.");
      } else if (error.response?.status === 404) {
        setErrorMessage("User not found.");
      } else if (error.code === "ERR_NETWORK") {
        setErrorMessage("Could not connect to server. Ensure backend is running.");
      } else {
        setErrorMessage(error.response?.data?.detail || "System error occurred.");
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
        if (response.data.token) {
          sessionStorage.setItem('authToken', response.data.token);
        }
        if (response.data.role) {
          sessionStorage.setItem('userRole', response.data.role);
        }
        sessionStorage.setItem('username', username);
        
        if (response.data.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard', { 
            state: { 
              clock_in_time: response.data.clock_in_time 
            } 
          });
        }
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.response?.status === 403) {
        const detail = error.response?.data?.detail || "";
        const parts = detail.split("|");
        if (parts.length === 2) {
          setLockedUntil(parts[1]);
          setErrorMessage(parts[0]);
        } else {
          setErrorMessage(detail);
        }
      } else if (error.response?.data?.detail) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Toggles */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow z-10"
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow z-10"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Secure Login
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Challenge-Response Authentication
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p>{errorMessage}</p>
                {remainingTime && <p className="mt-1 font-medium">{remainingTime}</p>}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* CREDENTIALS STEP */}
            {step === 'credentials' && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      placeholder="Enter username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d{0,4}$/.test(value)) {
                          setPin(value);
                        }
                      }}
                      maxLength={4}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      placeholder="Enter PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    PIN must be exactly 4 digits
                  </p>
                </div>

                <button
                  onClick={handleCredentialsSubmit}
                  disabled={!username || pin.length !== 4 || isProcessing || !!lockedUntil}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Verifying..." : "Get Challenge Code"}
                </button>
              </motion.div>
            )}

            {/* VOICE STEP */}
            {step === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Please speak these words clearly:
                  </p>
                  
                  {/* --- HIGH CONTRAST BOX --- */}
                  <div className="bg-white dark:bg-gray-700 border-2 border-blue-100 dark:border-gray-600 rounded-xl p-6 shadow-inner transition-colors duration-200">
                    <p className="text-xl md:text-2xl font-bold text-center tracking-wide text-gray-800 dark:text-white">
                      {challengeCode}
                    </p>
                  </div>
                  {/* --- END HIGH CONTRAST BOX --- */}

                </div>

                <div className="flex flex-col items-center gap-4">
                  {!audioBlob ? (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isRecording
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isRecording ? (
                        <Square className="w-8 h-8 text-white" />
                      ) : (
                        <Mic className="w-8 h-8 text-white" />
                      )}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Mic className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Recording Captured
                      </p>
                    </div>
                  )}

                  {isRecording ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Recording...
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Click stop when done
                      </p>
                    </div>
                  ) : audioBlob ? (
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retake
                    </button>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      Click mic to start recording
                    </p>
                  )}
                </div>

                {isRecording && (
                  <div className="mt-4">
                    <Waveform isActive={isRecording} />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setStep('credentials');
                      setAudioBlob(null);
                      setUsername('');
                      setPin('');
                    }}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLoginSubmit}
                    disabled={!audioBlob || isProcessing}
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Verifying..." : "Verify & Login"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}