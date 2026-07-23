'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

type Size = { width: number; height: number };

/**
 * Measures the parent box and passes pixel width/height to children.
 * Avoids Recharts ResponsiveContainer measuring 0×0 inside flex/overflow layouts.
 */
export function ChartViewport({
  height,
  className,
  children,
}: {
  height: number;
  className?: string;
  children: (size: Size) => ReactElement;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative w-full min-w-0 ${className ?? ''}`}
      style={{ height }}
    >
      {width > 0 ? children({ width, height }) : null}
    </div>
  );
}
