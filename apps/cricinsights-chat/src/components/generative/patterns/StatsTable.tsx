'use client';

import { motion } from 'framer-motion';

export function StatsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sky-200/15 bg-white/5">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold text-ink-dim"
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
                  <td key={j} className="px-4 py-2.5 text-ink">
                    {cell}
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
