import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, LogOut, CheckCircle, Clock, AlertCircle, Moon, Sun, Mic, X } from 'lucide-react';
import axios from 'axios';
import Waveform from './Waveform'; // Ensure you have this component file

interface UserDashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

interface Task {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
}

export default function UserDashboard({ darkMode, setDarkMode }: UserDashboardProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [username, setUsername] = useState('');
  
  // Clock Out States
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutResult, setClockOutResult] = useState<any>(null);
  
  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const user = localStorage.getItem('username');
    if (user) setUsername(user);
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get('http://127.0.0.1:8000/employee/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks", error);
    }
  };

  const markComplete = async (taskId: number) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`http://127.0.0.1:8000/employee/complete_task/${taskId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks();
    } catch (error) {
      console.error("Error completing task", error);
    }
  };

  // --- RECORDING LOGIC ---
  const handleStartClockOut = () => {
    setShowClockOutModal(true);
  };

  const handleRecordVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        submitClockOut(blob); // Send immediately after stop
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Record for 4 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          setIsProcessing(true);
        }
      }, 4000);

    } catch (err) {
      console.error("Mic error:", err);
      alert("Microphone access required to clock out.");
    }
  };

  const submitClockOut = async (audioBlob: Blob) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    // 1. Append Audio
    const file = new File([audioBlob], "clockout.webm", { type: "audio/webm" });
    formData.append('audio_file', file);

    // 2. Append Client Time
    const clientTime = new Date().toISOString();
    formData.append('client_time', clientTime);

    try {
      const response = await axios.post('http://127.0.0.1:8000/clock_out', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data' 
        }
      });
      setClockOutResult(response.data);
      setShowClockOutModal(false); // Close recording modal
    } catch (error) {
      console.error("Clock out failed", error);
      setIsProcessing(false);
      alert("Voice verification failed. Please try again.");
    }
  };

  const handleFinalLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">Hello, {username}</h1>
            <p className="text-sm text-green-600">● Clocked In (Working)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow">
            {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
          </button>
          
          {/* Main Clock Out Button */}
          {!clockOutResult && (
            <button onClick={handleStartClockOut} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Clock Out
            </button>
          )}
        </div>
      </div>

      {/* --- VOICE VERIFICATION MODAL --- */}
      <AnimatePresence>
        {showClockOutModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center relative">
              <button onClick={() => setShowClockOutModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Verify to Clock Out</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Please speak: <br/><span className="font-semibold text-blue-600">"I am completing my shift now"</span></p>

              <div className="flex flex-col items-center gap-4">
                <button 
                  onClick={handleRecordVoice}
                  disabled={isRecording || isProcessing}
                  className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all ${
                    isRecording ? 'bg-red-500 animate-pulse' : isProcessing ? 'bg-yellow-500' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Mic className="w-10 h-10 text-white" />
                </button>
                
                {isRecording && <p className="text-red-500 font-medium">Recording...</p>}
                {isProcessing && <p className="text-yellow-500 font-medium">Verifying Voice...</p>}
                {!isRecording && !isProcessing && <p className="text-gray-500 text-sm">Click to record</p>}
                
                {/* Visual Waveform if needed */}
                {isRecording && <Waveform isActive={true} />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CLOCK OUT RESULT MODAL (FINE ALERT) --- */}
      <AnimatePresence>
        {clockOutResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
              {clockOutResult.fine_applied !== "$0.0" ? (
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
              )}
              
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{clockOutResult.status}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Clock out successful at {new Date(clockOutResult.clock_out_time).toLocaleTimeString()}</p>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 mb-6">
                <div className="flex justify-between mb-2 text-gray-700 dark:text-gray-300">
                  <span>Pending Tasks:</span>
                  <span className="font-bold">{clockOutResult.pending_tasks}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-red-600">
                  <span>Fine Applied:</span>
                  <span>{clockOutResult.fine_applied}</span>
                </div>
              </div>

              <button onClick={handleFinalLogout} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all">
                Confirm & Exit
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TASK LIST */}
      <div className="max-w-4xl mx-auto grid gap-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Your Assigned Tasks</h2>
        
        {tasks.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 italic">No tasks assigned yet. Enjoy your coffee! ☕</p>
          </div>
        )}

        {tasks.map((task) => (
          <motion.div key={task.id} whileHover={{ y: -2 }} className={`p-6 rounded-xl border shadow-sm ${task.is_completed ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`font-bold text-lg ${task.is_completed ? 'text-green-700 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                  {task.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{task.description}</p>
              </div>
              {task.is_completed ? (
                <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Done
                </span>
              ) : (
                <button onClick={() => markComplete(task.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 shadow-md transition-all">
                  <Clock className="w-4 h-4" /> Mark Done
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}