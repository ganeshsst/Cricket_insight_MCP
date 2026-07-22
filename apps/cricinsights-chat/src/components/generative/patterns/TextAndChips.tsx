'use client';

import { motion } from 'framer-motion';
import { MarkdownProse } from './MarkdownProse';

export function TextBlock({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-ink"
    >
      <MarkdownProse content={content} className="text-[15px]" />
    </motion.div>
  );
}

export function FollowUpChips({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect?: (prompt: string) => void;
}) {
  if (!prompts.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect?.(prompt)}
          className="glass rounded-full px-3 py-1.5 text-xs text-ink-dim transition hover:text-ink hover:border-sky-300/40"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
