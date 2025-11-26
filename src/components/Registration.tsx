import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mic, Check, ArrowLeft, Moon, Sun, Eye, EyeOff, AlertCircle, Square, Trash2, RefreshCw } from 'lucide-react';
import Waveform from './Waveform';
import axios from 'axios';

interface RegistrationProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

// --- NEW: PHONETICALLY DIVERSE PHRASES ---
const REGISTRATION_PHRASES = [
  "The quick brown fox jumps over the lazy dog",      // Covers all 26 Alphabets
  "Pack my box with five dozen liquor jugs",          // Heavy on Plosives & Consonants
  "My voice is my unique biometric identity"          // Standard Context & Vowels
];

export default function Registration({ darkMode, setDarkMode }: RegistrationProps) {
  const navigate = useNavigate();
  
  // Steps: 1=Info, 2=Voice(3 samples), 3=Success
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Voice Recording State
  const [voiceStep, setVoiceStep] = useState(0); // 0, 1, 2
  const [audioBlobs, setAudioBlobs] = useState<(Blob | null)[]>([null, null, null]);
  const [isRecording, setIsRecording] = useState(false);
  
  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI Helpers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- NAVIGATION ---
  const handleNextStep = () => {
    if (step === 1) {
      if (username && password && password === confirmPassword) {
        setStep(2);
      }
    }
  };

  // --- RECORDING LOGIC ---
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
        
        setAudioBlobs(prev => {
          const newBlobs = [...prev];
          newBlobs[voiceStep] = blob;
          return newBlobs;
        });
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
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

  const deleteCurrentSample = () => {
    setAudioBlobs(prev => {
      const newBlobs = [...prev];
      newBlobs[voiceStep] = null;
      return newBlobs;
    });
  };

  const nextVoiceSample = () => {
    if (voiceStep < 2) {
      setVoiceStep(voiceStep + 1);
    }
  };

  const prevVoiceSample = () => {
    if (voiceStep > 0) {
      setVoiceStep(voiceStep - 1);
    }
  };

  // --- SUBMISSION ---
  const handleFinalSubmit = async () => {
    if (audioBlobs.some(blob => blob === null)) {
      setErrorMessage("Please record all 3 samples.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('username', username);
    formData.append('pin', password);
    
    audioBlobs.forEach((blob, index) => {
      if (blob) {
        const file = new File([blob], `sample_${index}.webm`, { type: "audio/webm" });
        formData.append('files', file);
      }
    });

    try {
      const response = await axios.post('http://127.0.0.1:8000/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        setStep(3);
      }
    } catch (error: any) {
      console.error("Registration failed", error);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
          Create Account
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Enhanced Security Enrollment
        </p>

        {/* Steps Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {errorMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 justify-center">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </motion.div>
        )}

        <motion.div layout className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: CREDENTIALS */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" placeholder="Choose a username" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" placeholder="Create a PIN" />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 text-gray-400">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Confirm PIN</label>
                  <div className="relative">
                     <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" placeholder="Repeat PIN" />
                    <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 text-gray-400">{showConfirmPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
                  </div>
                </div>
                <button onClick={handleNextStep} disabled={!username || !password || password !== confirmPassword} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg disabled:opacity-50 transition-all hover:scale-[1.01]">
                  Continue
                </button>
              </motion.div>
            )}

            {/* STEP 2: VOICE ENROLLMENT (3 SAMPLES) */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Voice Enrollment</h2>
                  <p className="text-gray-500 mb-6">Recording Sample {voiceStep + 1} of 3</p>
                  
                  {/* --- NEW: Dynamic Phrase Display --- */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8 min-h-[100px] flex items-center justify-center">
                    <motion.p 
                        key={voiceStep} // Animates when step changes
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg md:text-xl text-blue-700 dark:text-blue-300 font-medium font-serif italic"
                    >
                      "{REGISTRATION_PHRASES[voiceStep]}"
                    </motion.p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6">
                  {/* Mic Button */}
                  {!audioBlobs[voiceStep] ? (
                     <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      className="relative"
                    >
                      <motion.div animate={isRecording ? { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] } : {}} transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }} className="absolute inset-0 bg-blue-500 rounded-full blur-2xl" />
                      <div className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}>
                        {isRecording ? <Square className="w-12 h-12 text-white fill-current" /> : <Mic className="w-12 h-12 text-white" />}
                      </div>
                    </motion.button>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-xl">
                        <Check className="w-12 h-12 text-white" />
                      </div>
                      <button onClick={deleteCurrentSample} className="flex items-center gap-2 text-red-500 hover:text-red-600 text-sm font-medium">
                        <Trash2 className="w-4 h-4" /> Re-record Sample {voiceStep + 1}
                      </button>
                    </div>
                  )}

                  <div className="h-12 w-full flex items-center justify-center">
                    {isRecording ? <Waveform isActive={true} /> : <p className="text-gray-400 text-sm">
                        {audioBlobs[voiceStep] ? "Sample Captured" : "Click mic to record"}
                    </p>}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={prevVoiceSample} 
                    disabled={voiceStep === 0 || isSubmitting} 
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Back
                  </button>
                  
                  {voiceStep < 2 ? (
                     <button 
                       onClick={nextVoiceSample} 
                       disabled={!audioBlobs[voiceStep] || isRecording}
                       className="flex-1 py-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-50 hover:bg-blue-700 transition-all"
                     >
                       Next Sample
                     </button>
                  ) : (
                     <button 
                       onClick={handleFinalSubmit} 
                       disabled={!audioBlobs[2] || isSubmitting}
                       className="flex-1 py-3 bg-green-600 text-white rounded-xl shadow-lg disabled:opacity-50 hover:bg-green-700 transition-all"
                     >
                       {isSubmitting ? "Creating Profile..." : "Complete Registration"}
                     </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Check className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Registration Complete!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Your Secure Voice Profile is ready.</p>
                <button onClick={() => navigate('/login')} className="px-8 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                  Proceed to Login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}