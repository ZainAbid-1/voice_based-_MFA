import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Users, Shield, LogOut, Moon, Sun, Plus, CheckCircle } from 'lucide-react';
import axios from 'axios';

interface AdminDashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function AdminDashboard({ darkMode, setDarkMode }: AdminDashboardProps) {
  const navigate = useNavigate();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [message, setMessage] = useState('');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleAssignTask = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://127.0.0.1:8000/admin/assign_task', {
        title: taskTitle,
        description: taskDesc,
        assigned_to_username: assignee
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`Task assigned to ${assignee} successfully!`);
      setTaskTitle('');
      setTaskDesc('');
      setAssignee('');
    } catch (error) {
      console.error(error);
      setMessage("Failed to assign task. User may not exist.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow">
            {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5" /> Assign Employee Task
        </h2>

        {message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title</label>
            <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. Finish Monthly Report" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Details..." rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To (Username)</label>
            <input type="text" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. worker_joe" />
          </div>
          <button onClick={handleAssignTask} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Assign Task
          </button>
        </div>
      </div>
    </div>
  );
}