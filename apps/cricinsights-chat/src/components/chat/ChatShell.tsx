'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GenerativeRenderer } from '@/components/generative/GenerativeRenderer';
import type { CricInsightsResponse, UIComponent } from '@/types/generative-ui';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  ui?: UIComponent[];
};

const STARTERS = [
  "Virat Kohli's IPL stats",
  'Compare Bumrah and Starc',
  'Orange Cap IPL 2024',
];

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const nextMessages: Message[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as CricInsightsResponse & {
        text?: string;
      };
      if (!res.ok) {
        throw new Error(data.text || 'Chat request failed');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.text || '',
          ui: data.ui,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: msg,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-6 pt-8 sm:px-6">
      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-accent-2">
          CricInsights
        </p>
        <h1 className="display mt-2 text-4xl sm:text-5xl text-ink">
          Ask Cricket
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          Generative glass UI — heroes, charts, and live database tools.
        </p>
      </header>

      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 py-16 text-center">
              <p className="max-w-sm text-ink-dim text-sm">
                Ask about a player, a head-to-head, or a leaderboard. Answers
                render as glass stages — drag a player plaque to tilt it.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="glass rounded-full px-3 py-1.5 text-xs text-ink transition hover:border-sky-300/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={
                  m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }
              >
                {m.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-sky-400/15 px-4 py-2.5 text-sm border border-sky-300/25">
                    {m.content}
                  </div>
                ) : (
                  <div className="w-full max-w-full space-y-3">
                    {m.content ? (
                      <p className="text-[15px] leading-relaxed text-ink">
                        {m.content}
                      </p>
                    ) : null}
                    <GenerativeRenderer
                      ui={m.ui}
                      onFollowUp={(prompt) => void send(prompt)}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading ? (
            <div className="glass animate-pulse rounded-2xl px-4 py-6 text-sm text-ink-dim">
              Fetching cricket data…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-sky-200/10 bg-black/20 p-3 sm:p-4"
        >
          {error ? (
            <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about players, comparisons, leaderboards…"
              className="glass-strong flex-1 rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-ink-dim/70 focus:border-sky-300/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-2xl bg-gradient-to-br from-teal-300 to-sky-400 px-5 py-3 text-sm font-semibold text-[#031018] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
