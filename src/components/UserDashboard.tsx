import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Moon, Sun, LogOut, Clock, CheckCircle, Square, Mic, AlertCircle, RefreshCw } from 'lucide-react';
import Waveform from './Waveform';
import axios from 'axios';

interface UserDashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

interface Task {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
  assigned_at: string;
}

export default function UserDashboard({ darkMode, setDarkMode }: UserDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [isClocked, setIsClocked] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmittingClockOut, setIsSubmittingClockOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [clockOutResult, setClockOutResult] = useState<any>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const token = sessionStorage.getItem('authToken');
  const username = sessionStorage.getItem('username') || 'User';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const clockIn = location.state?.clock_in_time || sessionStorage.getItem('clock_in_time');
    if (clockIn) {
      setClockInTime(clockIn);
      setIsClocked(true);
      sessionStorage.setItem('clock_in_time', clockIn);
    }

    fetchTasks();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [token, navigate, location]);

  useEffect(() => {
    if (isClocked) {
      window.history.pushState(null, '', window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isClocked) {
        window.history.pushState(null, '', window.location.href);
        setShowClockOutModal(true);
        setErrorMessage('Please clock out before leaving this page.');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isClocked]);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/employee/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await axios.put(`http://127.0.0.1:8000/employee/complete_task/${taskId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
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

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
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

  const handleClockOut = async () => {
    if (!audioBlob) {
      setErrorMessage('Please record your voice first.');
      return;
    }

    setIsSubmittingClockOut(true);
    setErrorMessage('');

    const formData = new FormData();
    const file = new File([audioBlob], 'clockout.webm', { type: 'audio/webm' });
    formData.append('audio_file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/clock_out', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      setClockOutResult(response.data);
      setIsClocked(false);
      sessionStorage.removeItem('clock_in_time');
      
      setTimeout(() => {
        setShowClockOutModal(false);
        setClockOutResult(null);
      }, 5000);
    } catch (error: any) {
      console.error('Clock out failed:', error);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage('Clock out failed. Please try again.');
      }
    } finally {
      setIsSubmittingClockOut(false);
    }
  };

  const handleLogout = () => {
    if (isClocked) {
      setErrorMessage('You must clock out before logging out.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('clock_in_time');
    navigate('/');
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const utcString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const date = new Date(utcString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {username}!</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Employee Dashboard</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
          </div>
        </div>

        {errorMessage && !showClockOutModal && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 max-w-7xl mx-auto"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Time</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatTime(currentTime)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attendance Status</h3>
            
            {isClocked ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-600 dark:text-green-400 font-medium">Shift Started</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Clocked in at: <span className="font-semibold">{formatDate(clockInTime!)}</span>
                </p>
                <button
                  onClick={() => setShowClockOutModal(true)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-lg"
                >
                  Clock Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Not Working</span>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Task Board</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {completedTasks} of {totalTasks} tasks completed
              </p>
            </div>
            <button
              onClick={fetchTasks}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <div className="p-6">
            {tasks.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No tasks assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      task.is_completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {task.is_completed ? (
                          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className={`font-semibold ${
                            task.is_completed
                              ? 'text-green-900 dark:text-green-100 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{task.description}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            Assigned: {formatDate(task.assigned_at)}
                          </p>
                        </div>
                      </div>
                      
                      {!task.is_completed && (
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium flex-shrink-0"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {showClockOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Clock Out Verification</h3>
            
            {clockOutResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl ${
                  clockOutResult.status.includes('Fined')
                    ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                }`}>
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">Status: {clockOutResult.status}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Clock Out Time: {formatDate(clockOutResult.clock_out_time)}</p>
                  {clockOutResult.fine_applied !== '$0.0' && (
                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold mt-2">
                      Fine Applied: {clockOutResult.fine_applied}
                    </p>
                  )}
                  {clockOutResult.pending_tasks > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Pending Tasks: {clockOutResult.pending_tasks}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Please record yourself saying: <br />
                  <span className="font-bold text-lg">"I AM COMPLETING MY SHIFT NOW"</span>
                </p>

                {errorMessage && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 mb-6">
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

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isRecording ? (
                      <span className="font-medium text-red-600 dark:text-red-400">Recording...</span>
                    ) : audioBlob ? (
                      <span className="font-medium text-green-600 dark:text-green-400">✓ Recorded</span>
                    ) : (
                      <span>Click to record</span>
                    )}
                  </p>

                  {isRecording && (
                    <div className="flex justify-center">
                      <Waveform isActive={isRecording} />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowClockOutModal(false);
                      setAudioBlob(null);
                      setErrorMessage('');
                    }}
                    className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClockOut}
                    disabled={!audioBlob || isSubmittingClockOut}
                    className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg transition-all disabled:cursor-not-allowed"
                  >
                    {isSubmittingClockOut ? 'Verifying...' : 'Confirm Clock Out'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
