'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

/**
 * Safe, limited Markdown for prose (ai_summary / text widgets).
 * Allows emphasis and simple lists; blocks raw HTML and images.
 */
export function MarkdownProse({
  content,
  className,
  compact,
}: {
  content: string;
  className?: string;
  /** Smaller type for headlines */
  compact?: boolean;
}) {
  if (!content?.trim()) return null;

  return (
    <div
      className={cn(
        compact
          ? 'text-sm leading-snug [&_p]:m-0'
          : 'text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0',
        '[&_strong]:font-semibold [&_strong]:text-ink',
        '[&_em]:italic',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-0.5',
        className,
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ children }) => <span>{children}</span>,
          img: () => null,
          h1: ({ children }) => (
            <p className="display text-base font-semibold text-ink">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="display text-sm font-semibold text-ink">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="text-sm font-semibold text-ink">{children}</p>
          ),
          code: ({ children }) => (
            <span className="rounded bg-sky-950/40 px-1 font-mono text-[0.9em]">
              {children}
            </span>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-sky-950/40 p-2 text-xs">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
