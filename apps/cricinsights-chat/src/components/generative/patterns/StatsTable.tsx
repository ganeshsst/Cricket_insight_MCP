'use client';

import { motion } from 'framer-motion';

function isFormHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  return (
    h === 'recent form' ||
    h === 'form' ||
    h.includes('recent form') ||
    h === 'last 5'
  );
}

function parseFormTokens(cell: string | number): string[] | null {
  const raw = String(cell).trim();
  if (!raw) return null;
  // "W, L, W, W, L" | "W-L-W" | "WLWWL" | ["W","L"] via join already string
  const spaced = raw.includes(',') || raw.includes(' ') || raw.includes('-');
  let tokens: string[];
  if (spaced) {
    tokens = raw
      .split(/[,\s\-/|]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
  } else if (/^[WLNRD]+$/i.test(raw) && raw.length >= 2 && raw.length <= 10) {
    tokens = raw.toUpperCase().split('');
  } else {
    return null;
  }
  if (!tokens.length) return null;
  if (!tokens.every((t) => ['W', 'L', 'NR', 'N', 'D'].includes(t))) return null;
  return tokens.map((t) => (t === 'N' ? 'NR' : t));
}

function formDotClass(code: string): string {
  switch (code) {
    case 'W':
      return 'border-emerald-400/40 bg-emerald-400/25 text-emerald-200 shadow-[0_0_12px_-4px_rgba(52,211,153,0.55)]';
    case 'L':
      return 'border-rose-400/40 bg-rose-400/25 text-rose-200 shadow-[0_0_12px_-4px_rgba(251,113,133,0.55)]';
    case 'D':
      return 'border-amber-300/35 bg-amber-300/20 text-amber-100';
    default:
      return 'border-sky-300/30 bg-sky-400/15 text-ink-dim';
  }
}

function FormPills({ tokens }: { tokens: string[] }) {
  return (
    <div className="flex flex-nowrap items-center gap-1.5" title={tokens.join(' · ')}>
      {tokens.map((code, i) => (
        <span
          key={`${code}-${i}`}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold backdrop-blur-sm ${formDotClass(code)}`}
          aria-label={code === 'W' ? 'Win' : code === 'L' ? 'Loss' : code}
        >
          {code === 'NR' ? 'N' : code}
        </span>
      ))}
    </div>
  );
}

function CellContent({
  cell,
  forceForm,
}: {
  cell: string | number;
  forceForm: boolean;
}) {
  const tokens = parseFormTokens(cell);
  if (tokens && (forceForm || tokens.length >= 3)) {
    return <FormPills tokens={tokens} />;
  }
  return <>{cell}</>;
}

export function StatsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  const formCols = new Set(
    headers
      .map((h, i) => (isFormHeader(h) ? i : -1))
      .filter((i) => i >= 0),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-sm">
          <thead>
            <tr className="border-b border-sky-200/15 bg-white/5">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold text-ink-dim whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-sky-200/10 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-ink align-middle">
                    <CellContent cell={cell} forceForm={formCols.has(j)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
