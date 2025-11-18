import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Registration from './components/Registration';
import LoginPage from './components/LoginPage';
import AuthSuccess from './components/AuthSuccess';
import AuthFailure from './components/AuthFailure';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-blue-50'
    }`}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/register" element={<Registration darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/login" element={<LoginPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/auth-success" element={<AuthSuccess darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/auth-failure" element={<AuthFailure darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/dashboard" element={<UserDashboard darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/admin" element={<AdminDashboard darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}
