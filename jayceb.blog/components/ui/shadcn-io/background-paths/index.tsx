/* eslint-disable react-hooks/purity */
'use client';

import { motion } from 'framer-motion';

function FloatingPaths({ position }: { position: number }) {
  const spread = 2.4; 
  const verticalSpacing = 18; 
  const horizontalSpacing = 20; 

  const paths = Array.from({ length: 50 }, (_, i) => ({ 
    id: i,
    d: `M-${600 * spread - i * horizontalSpacing * position} -${189 + i * verticalSpacing}C-${
      600 * spread - i * horizontalSpacing * position
    } -${189 + i * verticalSpacing} -${500 * spread - i * horizontalSpacing * position} ${
      216 - i * verticalSpacing
    } ${300 * spread - i * horizontalSpacing * position} ${343 - i * verticalSpacing}C${
      900 * spread - i * horizontalSpacing * position
    } ${470 - i * verticalSpacing} ${1000 * spread - i * horizontalSpacing * position} ${875 - i * verticalSpacing} ${
      1000 * spread - i * horizontalSpacing * position
    } ${875 - i * verticalSpacing}`,
    width: 0.6 + i * 0.05, 
  }));

  return (
    <svg
      className="w-full h-full text-primary"
      viewBox={`${-1200 * spread} -1300 ${3000 * spread} 2000`} 
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
            duration: 25 + Math.random() * 15, 
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