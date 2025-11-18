import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, Moon, Sun, RefreshCw, HelpCircle } from 'lucide-react';

interface AuthFailureProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function AuthFailure({ darkMode, setDarkMode }: AuthFailureProps) {
  const navigate = useNavigate();
  const [failureReason] = useState<'pin' | 'voice' | 'both'>(
    Math.random() > 0.5 ? 'voice' : 'pin'
  );

  const getFailureMessage = () => {
    switch (failureReason) {
      case 'pin':
        return 'PIN or password did not match';
      case 'voice':
        return 'Voice biometric verification failed';
      case 'both':
        return 'Both PIN and voice verification failed';
      default:
        return 'Authentication failed';
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

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="max-w-md w-full text-center"
      >
        {/* Failure Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="relative mb-8 inline-block"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-red-500 rounded-full blur-3xl"
          />
          <div className="relative w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-2xl">
            <motion.div
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <AlertTriangle className="w-16 h-16 text-white" strokeWidth={2.5} />
            </motion.div>
          </div>
        </motion.div>

        {/* Failure Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
        >
          <h1 className="text-gray-900 dark:text-white mb-4">
            Authentication Failed
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            We couldn't verify your identity. Please check the details below.
          </p>

          {/* Failure Details */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-400 text-sm">PIN Verification</span>
              <span className={failureReason === 'pin' || failureReason === 'both' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {failureReason === 'pin' || failureReason === 'both' ? '✗ Failed' : '✓ Passed'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Voice Verification</span>
              <span className={failureReason === 'voice' || failureReason === 'both' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {failureReason === 'voice' || failureReason === 'both' ? '✗ Failed' : '✓ Passed'}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-8">
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              <span className="block mb-2">Reason:</span>
              <span className="text-red-600 dark:text-red-400">
                {getFailureMessage()}
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                // In a real app, this would open a support modal or navigate to support page
                alert('Support contact: support@voiceauth.com');
              }}
              className="w-full py-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-5 h-5" />
              Contact Support
            </motion.button>
          </div>
        </motion.div>

        {/* Additional Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-gray-500 dark:text-gray-400 text-sm mt-6"
        >
          <p className="mb-2">Having trouble logging in?</p>
          <button
            onClick={() => navigate('/register')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Create a new account
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
