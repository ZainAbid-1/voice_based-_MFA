import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Moon, Sun, LogOut, Shield, Mic, History, Settings, MapPin, CheckCircle, XCircle } from 'lucide-react';

interface UserDashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

interface LoginAttempt {
  id: number;
  timestamp: string;
  result: 'success' | 'failure';
  location: string;
}

export default function UserDashboard({ darkMode, setDarkMode }: UserDashboardProps) {
  const navigate = useNavigate();
  const [username] = useState('john_doe');
  
  const loginHistory: LoginAttempt[] = [
    { id: 1, timestamp: '2025-11-18 14:30:22', result: 'success', location: 'New York, USA' },
    { id: 2, timestamp: '2025-11-17 09:15:45', result: 'success', location: 'New York, USA' },
    { id: 3, timestamp: '2025-11-16 18:22:11', result: 'failure', location: 'Unknown Location' },
    { id: 4, timestamp: '2025-11-16 18:20:03', result: 'success', location: 'New York, USA' },
    { id: 5, timestamp: '2025-11-15 12:45:30', result: 'success', location: 'New York, USA' },
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      {/* Header */}
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
              <h1 className="text-gray-900 dark:text-white">Welcome back, {username}!</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Manage your account security</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-600" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white">Login History</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              View your recent authentication attempts
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }}
            onClick={() => {
              // In a real app, this would open a modal for voice re-enrollment
              alert('Voice re-enrollment feature coming soon!');
            }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Mic className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white">Voice Re-Enrollment</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Update your voice biometric sample
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ y: -4 }}
            onClick={() => {
              // In a real app, this would navigate to settings page
              alert('Security settings feature coming soon!');
            }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white">Security Settings</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Manage your security preferences
            </p>
          </motion.div>
        </div>

        {/* Login History Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-gray-900 dark:text-white">Recent Login Attempts</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Timestamp</th>
                  <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Result</th>
                  <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loginHistory.map((attempt, index) => (
                  <motion.tr
                    key={attempt.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {attempt.timestamp}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {attempt.result === 'success' ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-green-600 dark:text-green-400">Success</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-red-600 dark:text-red-400">Failed</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {attempt.location}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Admin Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <button
            onClick={() => navigate('/admin')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            Access Admin Dashboard →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
