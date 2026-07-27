'use client';

import { motion } from 'framer-motion';
import type { PodiumEntry } from '@/types/generative-ui';
import { cn } from '@/lib/cricinsights/utils';

export function Podium({
  title,
  entries,
}: {
  title?: string;
  entries: PodiumEntry[];
}) {
  const top = [...entries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      {title ? (
        <p className="display text-sm text-accent-2 mb-5">{title}</p>
      ) : null}
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {order.map((entry, visualIndex) => {
          const heights = ['h-28', 'h-36', 'h-24'];
          const isFirst = entry.rank === 1;
          return (
            <div
              key={`${entry.rank}-${entry.name}`}
              className="flex w-24 flex-col items-center gap-2 sm:w-28"
            >
              <div
                className={cn(
                  'relative h-16 w-16 overflow-hidden rounded-full ring-2',
                  isFirst ? 'ring-accent' : 'ring-sky-200/30',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl ?? undefined}
                  alt={entry.name}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <p className="text-center text-xs font-medium leading-tight">
                {entry.name}
              </p>
              <p className="text-accent text-sm font-semibold">
                {entry.value}
                {entry.metric ? (
                  <span className="text-ink-dim font-normal"> {entry.metric}</span>
                ) : null}
              </p>
              <div
                className={cn(
                  'glass-strong flex w-full items-start justify-center rounded-t-xl pt-2 text-lg display',
                  heights[visualIndex] ?? 'h-24',
                  isFirst && 'shadow-[0_0_30px_-8px_rgba(94,234,212,0.55)]',
                )}
              >
                {entry.rank}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
