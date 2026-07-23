'use client';

import { motion } from 'framer-motion';
import type { MetricDuelRow } from '@/types/generative-ui';
import { cn } from '@/lib/cricinsights/utils';

function toNum(v: string | number): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function barWidths(valueA: string | number, valueB: string | number) {
  const a = Math.abs(toNum(valueA) ?? 0);
  const b = Math.abs(toNum(valueB) ?? 0);
  const max = Math.max(a, b, 1);
  return { wA: (a / max) * 100, wB: (b / max) * 100 };
}

export function MetricDuelCard({
  title,
  labelA,
  labelB,
  rows,
  insight,
}: {
  title?: string;
  labelA?: string;
  labelB?: string;
  rows: MetricDuelRow[];
  insight?: string;
}) {
  if (!rows?.length) {
    return (
      <div className="glass rounded-2xl px-4 py-6 text-center text-sm text-ink-dim">
        No duel metrics.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-sky-200/10 px-4 py-3">
        <p className="display text-sm text-accent-2">{title ?? 'Face to face'}</p>
        {(labelA || labelB) && (
          <p className="text-[11px] text-ink-dim">
            <span className="text-ink">{labelA ?? 'A'}</span>
            <span className="mx-1.5 text-accent">vs</span>
            <span className="text-ink">{labelB ?? 'B'}</span>
          </p>
        )}
      </div>

      <div className="divide-y divide-sky-200/10">
        {rows.map((row, i) => {
          const { wA, wB } = barWidths(row.valueA, row.valueB);
          const winA = row.winner === 'a';
          const winB = row.winner === 'b';
          return (
            <motion.div
              key={`${row.metric}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[minmax(4.5rem,1fr)_auto_minmax(4.5rem,1fr)] items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_7rem_1fr] sm:gap-3"
            >
              <div className="text-right">
                <p
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    winA ? 'text-accent' : 'text-ink',
                  )}
                >
                  {row.valueA}
                </p>
                <div className="mt-1.5 ml-auto h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-sky-400/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${wA}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                    className={cn(
                      'h-full rounded-full',
                      winA ? 'bg-accent' : 'bg-sky-400/40',
                    )}
                  />
                </div>
              </div>

              <div className="px-1 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                  {row.metric}
                </p>
              </div>

              <div className="text-left">
                <p
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    winB ? 'text-accent' : 'text-ink',
                  )}
                >
                  {row.valueB}
                </p>
                <div className="mt-1.5 h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-sky-400/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${wB}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                    className={cn(
                      'h-full rounded-full',
                      winB ? 'bg-accent' : 'bg-sky-400/40',
                    )}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {insight ? (
        <p className="border-t border-sky-200/10 px-4 py-3 text-xs leading-relaxed text-ink-dim">
          {insight}
        </p>
      ) : null}
    </motion.div>
  );
}
