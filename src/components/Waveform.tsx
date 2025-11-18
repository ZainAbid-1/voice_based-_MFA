import { motion } from 'motion/react';

interface WaveformProps {
  isActive: boolean;
}

export default function Waveform({ isActive }: WaveformProps) {
  const bars = Array.from({ length: 30 }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1 h-24 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
      {bars.map((bar, index) => {
        const height = Math.random() * 60 + 20;
        const delay = index * 0.03;
        
        return (
          <motion.div
            key={bar}
            initial={{ scaleY: 0.3 }}
            animate={isActive ? {
              scaleY: [0.3, Math.random() + 0.5, 0.3],
            } : { scaleY: 0.3 }}
            transition={{
              duration: 0.6,
              repeat: isActive ? Infinity : 0,
              delay: delay,
              ease: "easeInOut",
            }}
            className="w-1.5 bg-gradient-to-t from-blue-500 to-blue-600 rounded-full origin-center"
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
