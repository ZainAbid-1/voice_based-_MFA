import { motion } from 'motion/react';

export default function SoundWaveIllustration() {
  const bars = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1 h-48 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-xl p-8 border border-blue-100 dark:border-gray-700">
      {bars.map((bar, index) => {
        const height = Math.abs(Math.sin((index / bars.length) * Math.PI * 2)) * 100 + 20;
        const delay = index * 0.05;
        
        return (
          <motion.div
            key={bar}
            initial={{ scaleY: 0.2 }}
            animate={{
              scaleY: [0.2, 1, 0.2],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: delay,
              ease: "easeInOut",
            }}
            className="w-1 bg-gradient-to-t from-blue-400 to-blue-600 rounded-full origin-center"
            style={{ height: `${height}%` }}
          />
        );
      })}
      
      {/* Microphone Icon in Center */}
      <div className="absolute">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="bg-white dark:bg-gray-800 p-6 rounded-full shadow-2xl"
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-blue-600 dark:text-blue-400"
          >
            <path
              d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z"
              fill="currentColor"
            />
            <path
              d="M19 10V11C19 14.87 15.87 18 12 18C8.13 18 5 14.87 5 11V10H3V11C3 15.97 7.03 20 12 20C16.97 20 21 15.97 21 11V10H19Z"
              fill="currentColor"
            />
            <path d="M11 21H13V24H11V21Z" fill="currentColor" />
            <path d="M8 23H16V24H8V23Z" fill="currentColor" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
