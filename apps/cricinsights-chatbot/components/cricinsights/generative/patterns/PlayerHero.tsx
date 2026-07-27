'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerHeroData } from '@/types/generative-ui';
import { cn } from '@/lib/cricinsights/utils';

type Props = {
  player: PlayerHeroData;
  size?: 'md' | 'lg';
  className?: string;
};

export function PlayerHero({ player, size = 'lg', className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const y = (px - 0.5) * 28;
      const x = (0.5 - py) * 22;
      setTilt({ x, y });
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  const dim = size === 'lg' ? 'h-56 w-56 sm:h-64 sm:w-64' : 'h-40 w-40';
  const sheenX = 50 + tilt.y * 1.5;
  const sheenY = 50 - tilt.x * 1.5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn('flex flex-col items-center gap-4', className)}
    >
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative touch-none select-none cursor-grab active:cursor-grabbing',
          dim,
        )}
        style={{ perspective: 900 }}
        title="Drag to tilt"
      >
        <motion.div
          animate={{
            rotateX: tilt.x,
            rotateY: tilt.y,
            y: dragging ? 0 : [0, -6, 0],
          }}
          transition={
            dragging
              ? { type: 'spring', stiffness: 320, damping: 24 }
              : { y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }
          }
          className="relative h-full w-full rounded-[2rem] glass-strong overflow-hidden"
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: `${-tilt.y * 0.6}px ${12 + tilt.x * 0.4}px 40px -8px rgba(0,0,0,0.55)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.imageUrl ?? undefined}
            alt={player.name}
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.35), transparent 45%)`,
              mixBlendMode: 'soft-light',
            }}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-sky-200/25 rounded-[2rem]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#031018]/90 to-transparent" />
        </motion.div>
      </div>

      <div className="text-center px-2">
        <h3 className="display text-2xl sm:text-3xl text-ink leading-none">
          {player.name}
        </h3>
        {player.subtitle ? (
          <p className="mt-1 text-sm text-ink-dim">{player.subtitle}</p>
        ) : null}
      </div>

      {player.chips?.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {player.chips.map((chip) => (
            <span
              key={chip.label}
              className="glass rounded-full px-3 py-1 text-xs font-medium tracking-wide"
            >
              <span className="text-ink-dim">{chip.label}</span>{' '}
              <span className="text-accent">{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
