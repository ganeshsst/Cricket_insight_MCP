'use client';

import { Fragment } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ComparisonEntity,
  MatchHeaderData,
  OverBar,
  PartnershipRow,
  ScorecardBatter,
  ScorecardBowler,
} from '@/types/generative-ui';
import { resolvePlayerPhoto } from '@/lib/utils';

const tooltipStyle = {
  background: 'rgba(8,20,32,0.95)',
  border: '1px solid rgba(125,211,252,0.35)',
  borderRadius: 12,
  color: '#e8f4ff',
};

const tooltipLabelStyle = {
  color: '#e8f4ff',
  fontWeight: 600,
};

const tooltipItemStyle = {
  color: '#e8f4ff',
};

function Empty({ label }: { label: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-8 text-center text-sm text-ink-dim">
      {label}
    </div>
  );
}

function Insight({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-3 text-xs leading-relaxed text-ink-dim">{text}</p>;
}

export function MatchHeaderCard({ match }: { match: MatchHeaderData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-xl text-ink sm:text-2xl">{match.title}</h2>
          {match.subtitle ? (
            <p className="mt-1 text-sm text-ink-dim">{match.subtitle}</p>
          ) : null}
        </div>
        {match.status ? (
          <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-wider text-accent-2">
            {match.status}
          </span>
        ) : null}
      </div>
      {match.scoreLine ? (
        <p className="mt-4 text-lg font-medium text-accent">{match.scoreLine}</p>
      ) : null}
      {match.venue ? (
        <p className="mt-2 text-xs text-ink-dim">{match.venue}</p>
      ) : null}
    </motion.div>
  );
}

export function ManhattanChartCard({
  title,
  innings,
  insight,
}: {
  title?: string;
  innings: { label: string; overs: OverBar[] }[];
  insight?: string;
}) {
  if (!innings?.length || innings.every((i) => !i.overs?.length)) {
    return <Empty label="No over-by-over data for this match." />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <p className="display mb-3 text-sm text-accent-2">
        {title ?? 'Manhattan — runs per over'}
      </p>
      <div className="space-y-6">
        {innings.map((inn) => {
          const data = inn.overs.map((o) => ({
            over: o.over,
            runs: o.runs,
            wickets: o.wickets ?? 0,
            bowler: o.bowler,
          }));
          return (
            <div key={inn.label}>
              <p className="mb-2 text-xs uppercase tracking-wider text-ink-dim">
                {inn.label}
              </p>
              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,.12)" />
                    <XAxis dataKey="over" tick={{ fill: '#9bb4c9', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9bb4c9', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value, _n, item) => {
                        const w = (item?.payload as { wickets?: number })?.wickets;
                        const bowler = (item?.payload as { bowler?: string })?.bowler;
                        const tip = `${value} runs${w ? ` · ${w} wkt` : ''}${bowler ? ` · ${bowler}` : ''}`;
                        return [tip, 'Over'];
                      }}
                      labelFormatter={(label) => `Over ${label}`}
                    />
                    <Bar dataKey="runs" radius={[6, 6, 0, 0]}>
                      {data.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.wickets > 0 ? '#fb7185' : '#5eead4'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
      <Insight text={insight} />
    </motion.div>
  );
}

export function PartnershipsCard({
  title,
  rows,
  insight,
}: {
  title?: string;
  rows: PartnershipRow[];
  insight?: string;
}) {
  if (!rows?.length) {
    return <Empty label="No partnership data available." />;
  }
  const max = Math.max(...rows.map((r) => r.runs), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <p className="display mb-4 text-sm text-accent-2">
        {title ?? 'Partnerships'}
      </p>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={`${r.players}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">
                {r.wicketNumber != null ? (
                  <span className="mr-2 text-ink-dim">{r.wicketNumber}.</span>
                ) : null}
                {r.players}
              </span>
              <span className="shrink-0 font-medium text-accent">
                {r.runs}
                {r.balls != null ? (
                  <span className="text-ink-dim"> ({r.balls}b)</span>
                ) : null}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sky-950/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-300 to-sky-400"
                style={{ width: `${(r.runs / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <Insight text={insight} />
    </motion.div>
  );
}

export function ScorecardMiniCard({
  title,
  batting,
  bowling,
  note,
}: {
  title?: string;
  batting: ScorecardBatter[];
  bowling?: ScorecardBowler[];
  note?: string;
}) {
  const hasBat = Boolean(batting?.length);
  const hasBowl = Boolean(bowling?.length);
  if (!hasBat && !hasBowl) {
    return <Empty label="Scorecard not available." />;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <p className="display border-b border-sky-200/10 px-4 py-3 text-sm text-accent-2">
        {title ?? (hasBat ? 'Scorecard' : 'Bowling')}
      </p>
      {hasBat ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-ink-dim">
                <th className="px-4 py-2 font-medium">Batter</th>
                <th className="px-4 py-2 font-medium text-right">R</th>
                <th className="px-4 py-2 font-medium text-right">B</th>
              </tr>
            </thead>
            <tbody>
              {batting.map((b, i) => (
                <tr key={`${b.name}-${i}`} className="border-t border-sky-200/10">
                  <td className="px-4 py-2.5">
                    <div className="text-ink">{b.name}</div>
                    {b.dismissal ? (
                      <div className="mt-0.5 text-xs leading-snug text-ink-dim">
                        {b.dismissal}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-accent">
                    {b.runs}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-dim">
                    {b.balls ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {hasBowl ? (
        <div
          className={`overflow-x-auto ${hasBat ? 'border-t border-sky-200/10' : ''}`}
        >
          {hasBat ? (
            <p className="px-4 pt-3 text-xs uppercase tracking-wider text-ink-dim">
              Bowling
            </p>
          ) : null}
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-ink-dim">
                <th className="px-4 py-2 font-medium">Bowler</th>
                <th className="px-4 py-2 font-medium text-right">O</th>
                <th className="px-4 py-2 font-medium text-right">M</th>
                <th className="px-4 py-2 font-medium text-right">R</th>
                <th className="px-4 py-2 font-medium text-right">W</th>
                <th className="px-4 py-2 font-medium text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              {bowling!.map((b, i) => (
                <tr key={`${b.name}-${i}`} className="border-t border-sky-200/10">
                  <td className="px-4 py-2.5 text-ink">{b.name}</td>
                  <td className="px-4 py-2.5 text-right text-ink-dim">{b.overs}</td>
                  <td className="px-4 py-2.5 text-right text-ink-dim">
                    {b.maidens ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-dim">{b.runs}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-accent">
                    {b.wickets}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-dim">
                    {b.economy ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {note ? <p className="px-4 py-3 text-xs text-ink-dim">{note}</p> : null}
    </motion.div>
  );
}

export function ComparisonTableCard({
  title,
  entities,
  metrics,
}: {
  title?: string;
  entities: ComparisonEntity[];
  metrics?: string[];
}) {
  if (!entities?.length) {
    return <Empty label="No comparison data." />;
  }

  const keys =
    metrics?.length
      ? metrics
      : Array.from(
          new Set(entities.flatMap((e) => Object.keys(e.stats ?? {}))),
        );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <p className="display border-b border-sky-200/10 px-4 py-3 text-sm text-accent-2">
        {title ?? 'Comparison'}
      </p>
      <div className="overflow-x-auto">
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `minmax(7rem,9rem) repeat(${entities.length}, minmax(8rem,1fr))`,
          }}
        >
          <div className="border-b border-sky-200/10 px-3 py-3 text-xs text-ink-dim" />
          {entities.map((e) => {
            const img = resolvePlayerPhoto(e.imageUrl, e.name);
            return (
              <div
                key={e.name}
                className="border-b border-l border-sky-200/10 px-3 py-3 text-center"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="mx-auto mb-2 h-12 w-12 rounded-full object-cover ring-1 ring-sky-300/30"
                  />
                ) : (
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/10 text-sm text-accent-2">
                    {e.name.slice(0, 1)}
                  </div>
                )}
                <p className="text-sm font-medium text-ink">{e.name}</p>
                {e.subtitle ? (
                  <p className="text-[11px] text-ink-dim">{e.subtitle}</p>
                ) : null}
              </div>
            );
          })}
          {keys.map((metric) => (
            <Fragment key={metric}>
              <div className="border-b border-sky-200/10 px-3 py-2.5 text-xs text-ink-dim">
                {metric}
              </div>
              {entities.map((e) => (
                <div
                  key={`${e.name}-${metric}`}
                  className="border-b border-l border-sky-200/10 px-3 py-2.5 text-center text-sm text-ink"
                >
                  {e.stats?.[metric] ?? '—'}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function AiInsightsCard({
  headline,
  text,
}: {
  headline: string;
  text: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl border-l-2 border-l-teal-300/70 p-5"
    >
      <p className="display text-sm text-accent">{headline}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{text}</p>
    </motion.div>
  );
}
