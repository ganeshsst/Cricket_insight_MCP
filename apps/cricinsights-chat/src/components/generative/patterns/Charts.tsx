'use client';

import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint, RadarPoint } from '@/types/generative-ui';

const tooltipStyle = {
  background: 'rgba(8,20,32,0.92)',
  border: '1px solid rgba(125,211,252,0.25)',
  borderRadius: 12,
  color: '#e8f4ff',
};

export function BarChartCard({
  title,
  metric,
  values,
  insight,
}: {
  title?: string;
  metric: string;
  values: ChartPoint[];
  insight?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <p className="display text-sm text-accent-2 mb-3">
        {title ?? metric}
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={values} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,.12)" />
            <XAxis dataKey="label" tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name={metric} fill="#5eead4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {insight ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">{insight}</p>
      ) : null}
    </motion.div>
  );
}

export function LineChartCard({
  title,
  metric,
  values,
}: {
  title?: string;
  metric: string;
  values: ChartPoint[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <p className="display text-sm text-accent-2 mb-3">
        {title ?? metric}
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={values} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,.12)" />
            <XAxis dataKey="label" tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              name={metric}
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={{ fill: '#5eead4', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

export function RadarCard({
  title,
  data,
}: {
  title?: string;
  data: RadarPoint[];
  players?: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <p className="display text-sm text-accent-2 mb-3">
        {title ?? 'Radar'}
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(125,211,252,.2)" />
            <PolarAngleAxis dataKey="label" tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <Radar
              dataKey="value"
              stroke="#5eead4"
              fill="#5eead4"
              fillOpacity={0.35}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
