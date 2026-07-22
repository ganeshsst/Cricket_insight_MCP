'use client';

import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STATUS_PHRASES = [
  'Taking strike…',
  'Setting the field…',
  'Reading the pitch…',
  'Building an innings…',
  'Composing the scoreboard…',
  'Gathering the numbers…',
  'Shaping your insights…',
] as const;

const ROTATE_MS = 2200;

function CricketBallIcon({ className }: { className?: string }) {
  const fillId = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill={`url(#${fillId})`} />
      <path
        d="M7 5.5c2.2 1.8 3.4 4.2 3.4 6.5S9.2 16.7 7 18.5"
        stroke="rgba(255,245,240,0.85)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17 5.5c-2.2 1.8-3.4 4.2-3.4 6.5s1.2 4.7 3.4 6.5"
        stroke="rgba(255,245,240,0.85)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <defs>
        <linearGradient id={fillId} x1="4" y1="3" x2="20" y2="21">
          <stop stopColor="#e11d48" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CricketThinking() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % STATUS_PHRASES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const phrase = STATUS_PHRASES[index];

  return (
    <div
      className="flex flex-col items-start gap-4 py-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          animate={{ rotate: 360, y: [0, -2, 0] }}
          transition={{
            rotate: { duration: 2.4, ease: 'linear', repeat: Infinity },
            y: { duration: 1.2, ease: 'easeInOut', repeat: Infinity },
          }}
        >
          <CricketBallIcon className="h-7 w-7 drop-shadow-[0_0_10px_rgba(225,29,72,0.4)]" />
        </motion.div>

        <div className="relative min-h-[1.5rem] min-w-[12rem] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={phrase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="text-sm text-ink-dim"
            >
              {phrase}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-sky-200/10">
        <motion.div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-teal-300/80 to-sky-400/80"
          animate={{ x: ['-100%', '280%'] }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
    </div>
  );
}
