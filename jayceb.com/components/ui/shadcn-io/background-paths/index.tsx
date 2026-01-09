/* eslint-disable react-hooks/purity */
'use client';

import { motion } from 'framer-motion';

function FloatingPaths({ position }: { position: number }) {
  const spread = 3; 
  const verticalSpacing = 22; 
  const horizontalSpacing = 22; 

const paths = Array.from({ length: 50 }, (_, i) => {
    const wave = Math.sin(i * 0.3) * 50;
    
    return {
      id: i,
      d: `M-${600 * spread - i * horizontalSpacing * position} -${189 + i * verticalSpacing}C-${
        600 * spread - i * horizontalSpacing * position
      } -${189 + i * verticalSpacing + wave} -${500 * spread - i * horizontalSpacing * position} ${
        216 - i * verticalSpacing + wave
      } ${300 * spread - i * horizontalSpacing * position} ${343 - i * verticalSpacing}C${
        900 * spread - i * horizontalSpacing * position
      } ${470 - i * verticalSpacing + wave} ${1000 * spread - i * horizontalSpacing * position} ${875 - i * verticalSpacing + wave} ${
        1000 * spread - i * horizontalSpacing * position
      } ${875 - i * verticalSpacing}`,
      width: 0.6 + i * 0.05,
    };
  });

  return (
    <svg
      className="w-full h-full text-primary"
      viewBox={`${-1200 * spread} -1200 ${3000 * spread} 2000`} 
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <title>Background Paths</title>
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={0.08 + path.id * 0.015} 
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{
            pathLength: 1,
            opacity: [0.25, 0.5, 0.25],
            pathOffset: [0, 1, 0],
          }}
          transition={{
            duration: 30, 
            delay: Math.random() * 2.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  );
}

export function BackgroundPaths() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}