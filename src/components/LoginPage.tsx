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
  
  // Audio & API States
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
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Turn off mic
        stream.getTracks().forEach(track => track.stop());
        
        // AUTOMATICALLY SUBMIT AFTER RECORDING STOPS
        handleLoginSubmit(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Record for 3 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          setIsProcessing(true);
        }
      }, 3000);

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

    try {
      const response = await axios.post('http://127.0.0.1:8000/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        // Success!
        navigate('/auth-success');
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setIsProcessing(false);
      
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Authentication failed. Please try again.");
      }

      // Optional: Redirect to failure page after a short delay or immediately
      // navigate('/auth-failure');
    }
  };

  const handleRetry = () => {
    setIsRecording(false);
    setIsProcessing(false);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Dark Mode Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-blue-600" />
        )}
      </motion.button>

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent"
        >
          Secure Login
        </motion.h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Complete both steps to access your account
        </p>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center">
            <motion.div
              animate={{
                backgroundColor: step === 'credentials' || step === 'voice' ? (darkMode ? '#3b82f6' : '#2563eb') : (darkMode ? '#374151' : '#e5e7eb'),
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            >
              <Lock className="w-6 h-6 text-white" />
            </motion.div>
            <div className={`w-16 h-1 mx-2 rounded ${step === 'voice' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`} />
            <motion.div
              animate={{
                backgroundColor: step === 'voice' ? (darkMode ? '#3b82f6' : '#2563eb') : (darkMode ? '#374151' : '#e5e7eb'),
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            >
              <Mic className={`w-6 h-6 ${step === 'voice' ? 'text-white' : 'text-gray-500'}`} />
            </motion.div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 justify-center"
          >
            <AlertTriangle className="w-5 h-5" />
            {errorMessage}
          </motion.div>
        )}

        {/* Main Card */}
        <motion.div
          layout
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Credentials */}
            {step === 'credentials' && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-gray-900 dark:text-white mb-6">
                  Step 1: Enter Credentials
                </h2>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                      placeholder="Enter username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">
                    PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                      placeholder="Enter PIN (e.g. 1234)"
                    />
                    <button
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCredentialsSubmit}
                  disabled={!username || !pin}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Voice Verification
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: Voice Verification */}
            {step === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-gray-900 dark:text-white mb-6">
                  Step 2: Voice Verification
                </h2>

                <div className="text-center mb-8">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Speak the phrase displayed below:
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">
                      "My voice is my password"
                    </p>
                  </div>
                </div>

                {/* Microphone Button */}
                <div className="flex flex-col items-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRecordVoice}
                    disabled={isRecording || isProcessing}
                    className="relative"
                  >
                    <motion.div
                      animate={isRecording ? {
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.6, 0.3],
                      } : {}}
                      transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }}
                      className="absolute inset-0 bg-blue-500 rounded-full blur-3xl"
                    />
                    <div className={`relative w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                      isRecording 
                        ? 'bg-gradient-to-br from-red-500 to-red-600' 
                        : isProcessing
                        ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                        : 'bg-gradient-to-br from-blue-600 to-blue-700'
                    }`}>
                      <Mic className="w-16 h-16 text-white" />
                    </div>
                  </motion.button>

                  {/* Status Text */}
                  <div className="text-center">
                    {isRecording && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-red-600 dark:text-red-400"
                      >
                        Recording...
                      </motion.p>
                    )}
                    {isProcessing && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-yellow-600 dark:text-yellow-400"
                      >
                        Verifying with AI...
                      </motion.p>
                    )}
                    {!isRecording && !isProcessing && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Click microphone to record
                      </p>
                    )}
                  </div>
                </div>

                {/* Waveform */}
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Waveform isActive={isRecording} />
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRetry}
                    disabled={isRecording || isProcessing}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Retry
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('credentials')}
                    disabled={isRecording || isProcessing}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
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