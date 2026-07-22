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
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint, RadarPoint } from '@/types/generative-ui';
import { ChartViewport } from './ChartViewport';

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
      <ChartViewport height={224}>
        {({ width, height }) => (
          <BarChart
            width={width}
            height={height}
            data={values}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,211,252,.12)" />
            <XAxis dataKey="label" tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9bb4c9', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="value"
              name={metric}
              fill="#5eead4"
              radius={[8, 8, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ChartViewport>
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
      <ChartViewport height={224}>
        {({ width, height }) => (
          <LineChart
            width={width}
            height={height}
            data={values}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
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
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ChartViewport>
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
      <ChartViewport height={256}>
        {({ width, height }) => (
          <RadarChart width={width} height={height} data={data}>
            <PolarGrid stroke="rgba(125,211,252,.2)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: '#9bb4c9', fontSize: 11 }}
            />
            <Radar
              dataKey="value"
              stroke="#5eead4"
              fill="#5eead4"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        )}
      </ChartViewport>
    </motion.div>
  );
}
