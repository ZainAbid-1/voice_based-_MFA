import { motion } from 'motion/react';

interface WaveformProps {
  isActive: boolean;
}

export default function Waveform({ isActive }: WaveformProps) {
  const bars = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1 h-16 w-full max-w-[200px]">
      {bars.map((bar, index) => {
        // Random height variation logic
        const baseHeight = 30; // 30%
        const randomHeight = Math.random() * 60 + 20;
        
        return (
          <motion.div
            key={bar}
            initial={{ height: '20%' }}
            animate={isActive ? {
              height: [`${baseHeight}%`, `${randomHeight}%`, `${baseHeight}%`],
              backgroundColor: ['#3b82f6', '#60a5fa', '#3b82f6'] // Pulse color too
            } : { 
              height: '20%',
              backgroundColor: '#9ca3af' // gray when inactive
            }}
            transition={{
              duration: 0.5,
              repeat: isActive ? Infinity : 0,
              delay: index * 0.05,
              ease: "easeInOut",
            }}
            className="w-1.5 rounded-full"
            style={{ backgroundColor: '#3b82f6' }}
          />
        );
      })}
    </div>
  );
}