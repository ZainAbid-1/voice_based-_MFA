import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  Moon, 
  Sun, 
  LogOut, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Menu,
  Home,
  FileText,
  Settings as SettingsIcon,
  TrendingUp,
  Activity
} from 'lucide-react';

interface AdminDashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

interface UserData {
  id: number;
  username: string;
  registrationDate: string;
  lastLogin: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface SystemLog {
  id: number;
  timestamp: string;
  type: 'success' | 'failure' | 'replay';
  username: string;
  details: string;
}

export default function AdminDashboard({ darkMode, setDarkMode }: AdminDashboardProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'settings'>('overview');

  const users: UserData[] = [
    { id: 1, username: 'john_doe', registrationDate: '2025-10-15', lastLogin: '2025-11-18 14:30', status: 'active' },
    { id: 2, username: 'jane_smith', registrationDate: '2025-10-20', lastLogin: '2025-11-18 10:15', status: 'active' },
    { id: 3, username: 'bob_wilson', registrationDate: '2025-11-01', lastLogin: '2025-11-17 16:45', status: 'active' },
    { id: 4, username: 'alice_brown', registrationDate: '2025-09-12', lastLogin: '2025-11-10 09:20', status: 'inactive' },
    { id: 5, username: 'charlie_davis', registrationDate: '2025-08-05', lastLogin: '2025-11-18 12:00', status: 'suspended' },
  ];

  const systemLogs: SystemLog[] = [
    { id: 1, timestamp: '2025-11-18 14:30:22', type: 'success', username: 'john_doe', details: 'Multi-factor authentication successful' },
    { id: 2, timestamp: '2025-11-18 14:25:11', type: 'failure', username: 'unknown_user', details: 'Invalid PIN attempt' },
    { id: 3, timestamp: '2025-11-18 14:20:45', type: 'success', username: 'jane_smith', details: 'Voice verification passed' },
    { id: 4, timestamp: '2025-11-18 14:15:30', type: 'replay', username: 'suspicious_user', details: 'Replay attack detected and blocked' },
    { id: 5, timestamp: '2025-11-18 14:10:18', type: 'failure', username: 'bob_wilson', details: 'Voice biometric mismatch' },
    { id: 6, timestamp: '2025-11-18 14:05:55', type: 'success', username: 'charlie_davis', details: 'Login successful' },
  ];

  const stats = {
    totalUsers: 1247,
    successfulLogins: 89,
    failedLogins: 12,
    replayDetected: 3,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'inactive':
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
      case 'suspended':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-xl z-10"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-gray-900 dark:text-white">Admin Panel</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Voice Auth</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'users'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Users</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'logs'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>System Logs</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'settings'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>User View</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              </button>
              <h1 className="text-gray-900 dark:text-white">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDarkMode(!darkMode)}
                className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-blue-600" />
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Users</p>
                  <p className="text-gray-900 dark:text-white">{stats.totalUsers.toLocaleString()}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Successful Logins Today</p>
                  <p className="text-gray-900 dark:text-white">{stats.successfulLogins}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Failed Logins Today</p>
                  <p className="text-gray-900 dark:text-white">{stats.failedLogins}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <Activity className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Replay Attacks Detected</p>
                  <p className="text-gray-900 dark:text-white">{stats.replayDetected}</p>
                </motion.div>
              </div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-gray-900 dark:text-white">Recent System Logs</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {systemLogs.slice(0, 3).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                        <div className="flex items-center gap-4">
                          {log.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                          {log.type === 'failure' && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                          {log.type === 'replay' && <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />}
                          <div>
                            <p className="text-gray-900 dark:text-white text-sm">{log.username}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">{log.details}</p>
                          </div>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">{log.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-gray-900 dark:text-white">All Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Username</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Registration Date</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Last Login</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 text-gray-900 dark:text-white">{user.username}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{user.registrationDate}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{user.lastLogin}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(user.status)}`}>
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-gray-900 dark:text-white">System Logs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Timestamp</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Username</th>
                      <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {systemLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 text-gray-900 dark:text-white">{log.timestamp}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {log.type === 'success' && (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-green-600 dark:text-green-400">Success</span>
                              </>
                            )}
                            {log.type === 'failure' && (
                              <>
                                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                <span className="text-red-600 dark:text-red-400">Failure</span>
                              </>
                            )}
                            {log.type === 'replay' && (
                              <>
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                <span className="text-yellow-600 dark:text-yellow-400">Replay Detected</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">{log.username}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
            >
              <h2 className="text-gray-900 dark:text-white mb-6">System Settings</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Settings configuration panel coming soon...
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
