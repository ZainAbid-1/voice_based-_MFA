import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mic, Check, ArrowLeft, Moon, Sun, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Waveform from './Waveform';
import axios from 'axios';

interface RegistrationProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function Registration({ darkMode, setDarkMode }: RegistrationProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // Acts as PIN
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Audio & API States
  const [isRecording, setIsRecording] = useState(false);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleNextStep = () => {
    if (step < 3) setStep(step + 1);
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setVoiceRecorded(true);
        // Turn off mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Auto-stop after 3 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 3000);

    } catch (err) {
      console.error("Mic Error:", err);
      setErrorMessage("Microphone access denied. Please check permissions.");
    }
  };

  const handleSubmitVoice = async () => {
    if (!audioBlob || !username || !password) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('username', username);
    formData.append('pin', password); // We use the password field as the PIN
    // Convert blob to file
    const file = new File([audioBlob], "register.webm", { type: "audio/webm" });
    formData.append('audio_file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        setStep(3); // Go to success screen
      }
    } catch (error: any) {
      console.error("Registration failed", error);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Server connection failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent"
        >
          Create Your Account
        </motion.h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Complete all steps to secure your account
        </p>

        {/* Steps Indicator */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: step === s ? 1.1 : 1,
                  backgroundColor: step >= s ? (darkMode ? '#3b82f6' : '#2563eb') : (darkMode ? '#374151' : '#e5e7eb'),
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              >
                {step > s ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span className={`${step >= s ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                )}
              </motion.div>
              {s < 3 && (
                <div className={`w-16 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center gap-8 mb-8">
          <span className={`text-sm ${step === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            Account Info
          </span>
          <span className={`text-sm ${step === 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            Voice Enrollment
          </span>
          <span className={`text-sm ${step === 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
            Complete
          </span>
        </div>

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 justify-center"
          >
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </motion.div>
        )}

        {/* Main Card */}
        <motion.div
          layout
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Account Info */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
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
                    PIN (Password)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                      placeholder="Enter PIN (e.g., 1234)"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">
                    Confirm PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                      placeholder="Confirm PIN"
                    />
                    <button
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNextStep}
                  disabled={!username || !password || password !== confirmPassword}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Voice Enrollment
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: Voice Enrollment */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Please speak the phrase:
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-blue-700 dark:text-blue-300 font-medium">
                      "My voice is my password."
                    </p>
                  </div>
                </div>

                {/* Microphone Button */}
                <div className="flex flex-col items-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRecordVoice}
                    disabled={isRecording}
                    className="relative"
                  >
                    <motion.div
                      animate={isRecording ? {
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5],
                      } : {}}
                      transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }}
                      className="absolute inset-0 bg-blue-500 rounded-full blur-2xl"
                    />
                    <div className={`relative w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                      isRecording 
                        ? 'bg-gradient-to-br from-red-500 to-red-600' 
                        : voiceRecorded 
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : 'bg-gradient-to-br from-blue-600 to-blue-700'
                    }`}>
                      <Mic className="w-16 h-16 text-white" />
                    </div>
                  </motion.button>

                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {isRecording ? 'Recording...' : voiceRecorded ? 'Voice Captured!' : 'Click to record'}
                  </p>
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

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitVoice}
                  disabled={!voiceRecorded || isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Registering..." : "Submit Voice Sample"}
                </motion.button>
              </motion.div>
            )}

            {/* Step 3: Complete */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
                >
                  <Check className="w-12 h-12 text-white" />
                </motion.div>

                <h2 className="text-gray-900 dark:text-white mb-4">
                  Registration Successful!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Your account has been created and your voice sample has been enrolled.
                </p>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  Go to Login
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}