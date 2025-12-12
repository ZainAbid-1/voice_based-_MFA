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

const REGISTRATION_PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "My voice is my unique biometric identity"
];

export default function Registration({ darkMode, setDarkMode }: RegistrationProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [voiceStep, setVoiceStep] = useState(0);
  const [audioBlobs, setAudioBlobs] = useState<(Blob | null)[]>([null, null, null]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<('idle' | 'uploading' | 'done' | 'error')[]>(['idle', 'idle', 'idle']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleNextStep = async () => {
    if (step === 1) {
      if (username && password && password === confirmPassword) {
        setIsCheckingUsername(true);
        setErrorMessage('');
        
        try {
          await axios.get(`http://127.0.0.1:8000/check_username/${username}`);
          
          await axios.post('http://127.0.0.1:8000/register/init', {
            username,
            pin: password,
            role: 'employee'
          });
          
          setStep(2);
        } catch (error: any) {
          if (error.response?.status === 409) {
            setErrorMessage('Username already taken. Please choose another.');
          } else if (error.response?.data?.detail) {
            setErrorMessage(error.response.data.detail);
          } else {
            setErrorMessage('Failed to initialize registration. Please try again.');
          }
        } finally {
          setIsCheckingUsername(false);
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlobs(prev => {
          const newBlobs = [...prev];
          newBlobs[voiceStep] = blob;
          return newBlobs;
        });
        stream.getTracks().forEach(track => track.stop());
        
        await uploadSample(blob, voiceStep);
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

  const uploadSample = async (blob: Blob, sampleIndex: number) => {
    setUploadStatus(prev => {
      const newStatus = [...prev];
      newStatus[sampleIndex] = 'uploading';
      return newStatus;
    });
    
    const formData = new FormData();
    formData.append('username', username);
    formData.append('sample_index', sampleIndex.toString());
    const file = new File([blob], `sample_${sampleIndex}.webm`, { type: 'audio/webm' });
    formData.append('file', file);
    
    try {
      await axios.post('http://127.0.0.1:8000/register/upload_sample', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadStatus(prev => {
        const newStatus = [...prev];
        newStatus[sampleIndex] = 'done';
        return newStatus;
      });
    } catch (error: any) {
      console.error(`Sample ${sampleIndex + 1} upload failed:`, error);
      setUploadStatus(prev => {
        const newStatus = [...prev];
        newStatus[sampleIndex] = 'error';
        return newStatus;
      });
      
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage(`Failed to upload sample ${sampleIndex + 1}. Please try again.`);
      }
    }
  };

  const deleteCurrentSample = () => {
    setAudioBlobs(prev => {
      const newBlobs = [...prev];
      newBlobs[voiceStep] = null;
      return newBlobs;
    });
    setUploadStatus(prev => {
      const newStatus = [...prev];
      newStatus[voiceStep] = 'idle';
      return newStatus;
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

  const handleFinalSubmit = async () => {
    if (uploadStatus.some(status => status !== 'done')) {
      setErrorMessage("Please wait for all samples to finish uploading.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('username', username);

    try {
      const response = await axios.post('http://127.0.0.1:8000/register/finalize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        setStep(3);
      }
    } catch (error: any) {
      console.error("Registration finalization failed", error);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
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
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Create Account
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Enhanced Security Enrollment
            </p>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center justify-center mb-8 gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 mx-1 transition-all ${
                      step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: CREDENTIALS */}
            {step === 1 && (
              <motion.div
                key="step1"
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
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      placeholder="Choose a username"
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
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      placeholder="Create a PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      placeholder="Repeat PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleNextStep}
                  disabled={!username || !password || password !== confirmPassword || isCheckingUsername}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
                >
                  {isCheckingUsername ? 'Checking username...' : 'Continue'}
                </button>
              </motion.div>
            )}

            {/* STEP 2: VOICE ENROLLMENT */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Voice Enrollment
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recording Sample {voiceStep + 1} of 3
                  </p>
                </div>

                {/* --- HIGH CONTRAST BOX FIX --- */}
                <div className="bg-white dark:bg-gray-700 border-2 border-blue-100 dark:border-gray-600 rounded-xl p-6 shadow-inner transition-colors duration-200">
                  <p className="text-xl font-bold text-center tracking-wide text-gray-800 dark:text-white">
                    "{REGISTRATION_PHRASES[voiceStep]}"
                  </p>
                </div>
                {/* --- END FIX --- */}

                <div className="flex flex-col items-center gap-4">
                  {!audioBlobs[voiceStep] ? (
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
                    <button
                      onClick={() => {
                        deleteCurrentSample();
                        startRecording();
                      }}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-record Sample {voiceStep + 1}
                    </button>
                  )}

                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {isRecording ? (
                      <span className="font-medium text-red-600 dark:text-red-400">Recording...</span>
                    ) : uploadStatus[voiceStep] === 'uploading' ? (
                      <span className="font-medium text-blue-600 dark:text-blue-400">Uploading...</span>
                    ) : uploadStatus[voiceStep] === 'done' ? (
                      <span className="font-medium text-green-600 dark:text-green-400">✓ Uploaded</span>
                    ) : uploadStatus[voiceStep] === 'error' ? (
                      <span className="font-medium text-red-600 dark:text-red-400">Upload failed</span>
                    ) : (
                      <span>{audioBlobs[voiceStep] ? "Sample Captured" : "Click mic to record"}</span>
                    )}
                  </p>
                </div>

                {isRecording && <Waveform isActive={isRecording} />}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={prevVoiceSample}
                    disabled={voiceStep === 0}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Back
                  </button>
                  {voiceStep < 2 ? (
                    <button
                      onClick={nextVoiceSample}
                      disabled={uploadStatus[voiceStep] !== 'done'}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
                    >
                      Next Sample
                    </button>
                  ) : (
                    <button
                      onClick={handleFinalSubmit}
                      disabled={uploadStatus.some(s => s !== 'done') || isSubmitting}
                      className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Finalizing..." : "Complete Registration"}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Registration Complete!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your Secure Voice Profile is ready.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all"
                >
                  Proceed to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}