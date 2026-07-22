'use client';

import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type IconKind =
  | 'bat'
  | 'field'
  | 'pitch'
  | 'batHit'
  | 'scoreboard'
  | 'ball'
  | 'stumps';

const STATUS_STEPS: { phrase: string; icon: IconKind }[] = [
  { phrase: 'Taking strike…', icon: 'bat' },
  { phrase: 'Setting the field…', icon: 'field' },
  { phrase: 'Reading the pitch…', icon: 'pitch' },
  { phrase: 'Building an innings…', icon: 'batHit' },
  { phrase: 'Composing the scoreboard…', icon: 'scoreboard' },
  { phrase: 'Gathering the numbers…', icon: 'ball' },
  { phrase: 'Shaping your insights…', icon: 'stumps' },
];

const ROTATE_MS = 2200;

const ICON_CLASS = 'h-8 w-8';

/** Side-profile cricket bat: wide blade, shoulder, handle, grip. */
function CricketBatShape() {
  return (
    <g>
      <path
        d="M8.5 2.8h7c1 0 1.8.8 1.8 1.8v8.8c0 1.5-1.1 2.7-2.6 2.8l-1.5.1-.9.7c-.3.2-.7.2-1 0l-.9-.7-1.5-.1c-1.5-.1-2.6-1.3-2.6-2.8V4.6c0-1 .8-1.8 1.8-1.8z"
        fill="#e8c98a"
        stroke="#a67c52"
        strokeWidth="0.6"
      />
      <path
        d="M12 3.8v9.2"
        stroke="#c9a66b"
        strokeWidth="0.55"
        strokeLinecap="round"
        opacity="0.65"
      />
      <rect x="10.4" y="15.8" width="3.2" height="4.6" rx="0.65" fill="#c4a574" stroke="#8b6914" strokeWidth="0.45" />
      <rect x="10.4" y="18.6" width="3.2" height="2" rx="0.35" fill="#3d2914" />
    </g>
  );
}

function BallSvg({
  className,
  cx = 12,
  cy = 12,
  r = 5,
}: {
  className?: string;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  const fillId = useId().replace(/:/g, '');
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${fillId})`} className={className} />
      <defs>
        <linearGradient id={fillId} x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r}>
          <stop stopColor="#e11d48" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>
      </defs>
    </>
  );
}

function BatIcon() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={ICON_CLASS}
      fill="none"
      aria-hidden
      animate={{ rotate: [-10, -2, -10] }}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
    >
      <CricketBatShape />
    </motion.svg>
  );
}

function FieldIcon() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={ICON_CLASS}
      fill="none"
      aria-hidden
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
    >
      <ellipse cx="12" cy="12" rx="9" ry="7" fill="#1a5c3a" opacity="0.85" />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="7"
        stroke="#34d399"
        strokeWidth="1"
        opacity="0.5"
      />
      <rect x="10.5" y="9" width="3" height="6" rx="0.4" fill="#86efac" opacity="0.35" />
      {[
        [12, 5.5],
        [6.5, 9],
        [17.5, 9],
        [7.5, 15],
        [16.5, 15],
        [12, 17.5],
      ].map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="1.15"
          fill="#f8fafc"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{
            duration: 1.4,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.12,
          }}
        />
      ))}
    </motion.svg>
  );
}

function PitchIcon() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={ICON_CLASS}
      fill="none"
      aria-hidden
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
    >
      {/* outfield */}
      <ellipse cx="12" cy="12" rx="10" ry="8.5" fill="#166534" />
      <ellipse cx="12" cy="12" rx="10" ry="8.5" stroke="#34d399" strokeWidth="0.8" opacity="0.45" />
      {/* pitch strip */}
      <rect x="10.2" y="3.5" width="3.6" height="17" rx="0.45" fill="#d4a574" />
      {/* bowling crease (top) */}
      <line x1="8.8" y1="5.2" x2="15.2" y2="5.2" stroke="#f8fafc" strokeWidth="1.3" strokeLinecap="round" />
      {/* popping crease (top) */}
      <line x1="9.4" y1="6.8" x2="14.6" y2="6.8" stroke="#f8fafc" strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
      {/* batting crease (bottom) */}
      <line x1="8.8" y1="18.8" x2="15.2" y2="18.8" stroke="#f8fafc" strokeWidth="1.3" strokeLinecap="round" />
      {/* stumps at bowler's end */}
      <rect x="11.1" y="3.8" width="0.75" height="2.2" rx="0.2" fill="#f1e6c8" />
      <rect x="11.65" y="3.8" width="0.75" height="2.2" rx="0.2" fill="#f1e6c8" />
      <rect x="12.2" y="3.8" width="0.75" height="2.2" rx="0.2" fill="#f1e6c8" />
      <rect x="11" y="3.5" width="2.05" height="0.55" rx="0.15" fill="#c4a574" />
    </motion.svg>
  );
}

function BatHitIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" aria-hidden>
      <motion.g
        style={{ originX: '12px', originY: '20px' }}
        animate={{ rotate: [-35, 22, -35] }}
        transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
      >
        <CricketBatShape />
      </motion.g>
      <motion.g
        animate={{ x: [-1, 9, -1], y: [1, -7, 1], opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
      >
        <BallSvg cx={11} cy={9} r={3.2} />
      </motion.g>
    </svg>
  );
}

function ScoreboardIcon() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={ICON_CLASS}
      fill="none"
      aria-hidden
      animate={{ opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" fill="#0f2740" stroke="#38bdf8" strokeWidth="1" />
      <motion.rect
        x="5.5"
        y="8"
        width="5"
        height="2.2"
        rx="0.4"
        fill="#5eead4"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      <motion.rect
        x="13.5"
        y="8"
        width="5"
        height="2.2"
        rx="0.4"
        fill="#38bdf8"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
      />
      <rect x="5.5" y="12.5" width="13" height="1.6" rx="0.3" fill="#94a3b8" opacity="0.45" />
      <rect x="5.5" y="15.2" width="9" height="1.6" rx="0.3" fill="#94a3b8" opacity="0.3" />
    </motion.svg>
  );
}

function BallIcon() {
  return (
    <motion.div
      className={`flex ${ICON_CLASS} items-center justify-center`}
      animate={{ rotate: 360, y: [0, -2, 0] }}
      transition={{
        rotate: { duration: 2.4, ease: 'linear', repeat: Infinity },
        y: { duration: 1.2, ease: 'easeInOut', repeat: Infinity },
      }}
    >
      <svg viewBox="0 0 24 24" className={`${ICON_CLASS} drop-shadow-[0_0_10px_rgba(225,29,72,0.4)]`} fill="none" aria-hidden>
        <BallSvg cx={12} cy={12} r={10} />
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
      </svg>
    </motion.div>
  );
}

function StumpsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" aria-hidden>
      <motion.g
        animate={{ x: [0, 8, 8], opacity: [0.3, 1, 0] }}
        transition={{ duration: 1.3, ease: 'easeInOut', repeat: Infinity }}
      >
        <BallSvg cx={5} cy={11} r={2.8} />
      </motion.g>
      <motion.g
        animate={{ rotate: [0, 0, 8, -6, 0] }}
        transition={{ duration: 1.3, ease: 'easeInOut', repeat: Infinity }}
        style={{ originX: '16px', originY: '20px' }}
      >
        <rect x="12.2" y="6" width="1.5" height="14" rx="0.4" fill="#f1e6c8" />
        <rect x="15" y="6" width="1.5" height="14" rx="0.4" fill="#f1e6c8" />
        <rect x="17.8" y="6" width="1.5" height="14" rx="0.4" fill="#f1e6c8" />
        <motion.rect
          x="12"
          y="5.2"
          width="7.5"
          height="1.1"
          rx="0.4"
          fill="#c4a574"
          animate={{ y: [0, 0, -3, 4], opacity: [1, 1, 1, 0] }}
          transition={{ duration: 1.3, ease: 'easeInOut', repeat: Infinity }}
        />
      </motion.g>
    </svg>
  );
}

function StatusIcon({ kind }: { kind: IconKind }) {
  switch (kind) {
    case 'bat':
      return <BatIcon />;
    case 'field':
      return <FieldIcon />;
    case 'pitch':
      return <PitchIcon />;
    case 'batHit':
      return <BatHitIcon />;
    case 'scoreboard':
      return <ScoreboardIcon />;
    case 'ball':
      return <BallIcon />;
    case 'stumps':
      return <StumpsIcon />;
  }
}

export function CricketThinking() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % STATUS_STEPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const step = STATUS_STEPS[index];

  return (
    <div
      className="flex flex-col items-start gap-4 py-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-visible">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.icon}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <StatusIcon kind={step.icon} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative min-h-[1.5rem] min-w-[12rem] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step.phrase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="text-sm text-ink-dim"
            >
              {step.phrase}
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
