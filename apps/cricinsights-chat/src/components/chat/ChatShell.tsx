'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GenerativeRenderer } from '@/components/generative/GenerativeRenderer';
import { AiInsightsCard } from '@/components/generative/patterns/MatchWidgets';
import type {
  BedrockUsageMeta,
  CricInsightsResponse,
  LayoutType,
  UIComponent,
} from '@/types/generative-ui';

type HistoryMessage = { role: 'user' | 'assistant'; content: string };

type PageState = {
  layout: LayoutType;
  title: string;
  ai_summary: { headline: string; text: string };
  widgets: UIComponent[];
};

type Turn = {
  id: string;
  query: string;
  page: PageState | null;
  usage?: BedrockUsageMeta;
  error?: string;
};

const STARTERS = [
  "Virat Kohli's IPL stats",
  'Compare Kohli and Rohit in IPL T20',
  'Orange Cap IPL 2026',
  'Over-by-over for RCB vs GT IPL 2026 final',
  'Biggest partnerships in that RCB vs GT match',
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function SkeletonCard() {
  return (
    <div className="space-y-4 overflow-hidden">
      <div className="glass h-20 animate-pulse rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass h-48 animate-pulse rounded-2xl" />
        <div className="glass h-48 animate-pulse rounded-2xl" />
      </div>
      <p className="text-center text-sm text-ink-dim">Building your cricket page…</p>
    </div>
  );
}

function AnswerCard({
  turn,
  onFollowUp,
}: {
  turn: Turn;
  onFollowUp: (prompt: string) => void;
}) {
  return (
    <article className="answer-card w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/15 bg-[rgba(8,20,32,0.45)] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)]">
      <div className="border-b border-sky-200/10 px-4 py-3 sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent-2">You asked</p>
        <p className="mt-1 break-words text-sm text-ink">{turn.query}</p>
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 py-4 sm:px-5">
        {turn.error ? (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {turn.error}
          </div>
        ) : null}

        {turn.page ? (
          <>
            <div>
              <h2 className="display text-xl text-ink sm:text-2xl">{turn.page.title}</h2>
            </div>
            <AiInsightsCard
              headline={turn.page.ai_summary.headline}
              text={turn.page.ai_summary.text}
            />
            <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
              <GenerativeRenderer
                ui={turn.page.widgets}
                onFollowUp={onFollowUp}
              />
            </div>
            {turn.usage ? (
              <p className="border-t border-sky-200/10 pt-3 text-[11px] text-ink-dim">
                {turn.usage.inputTokens.toLocaleString()} input ·{' '}
                {turn.usage.outputTokens.toLocaleString()} output ·{' '}
                {turn.usage.totalTokens.toLocaleString()} total ·{' '}
                {turn.usage.costFormatted} · {turn.usage.steps} step
                {turn.usage.steps === 1 ? '' : 's'}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export function ChatShell() {
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loading]);

  function clearChat() {
    if (loading) return;
    setHistory([]);
    setTurns([]);
    setInput('');
    setError(null);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const turnId = newId();
    const nextHistory: HistoryMessage[] = [
      ...history,
      { role: 'user', content: trimmed },
    ];
    setHistory(nextHistory);
    setTurns((prev) => [...prev, { id: turnId, query: trimmed, page: null }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as CricInsightsResponse & {
        text?: string;
      };
      if (!res.ok) {
        throw new Error(data.text || 'Request failed');
      }

      const summary = data.ai_summary ?? {
        headline: data.title || 'Insight',
        text: data.text || '',
      };

      const page: PageState = {
        layout: data.layout ?? 'generic',
        title: data.title || summary.headline || 'CricInsights',
        ai_summary: summary,
        widgets: data.ui ?? [],
      };

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, page, usage: data.meta } : t,
        ),
      );

      const widgetTypes = (data.ui ?? []).map((w) => w.type).join(', ') || 'none';
      const isClarify =
        (data.ui ?? []).some((w) => w.type === 'follow_up_chips') &&
        !(data.ui ?? []).some((w) =>
          [
            'metric_duel',
            'comparison_table',
            'stats_table',
            'player_hero',
            'duel_stage',
            'scorecard_mini',
            'manhattan_chart',
            'podium',
          ].includes(w.type),
        );
      const stub = isClarify
        ? `[Page rendered: CLARIFY page layout=${data.layout ?? 'generic'}, title="${data.title || summary.headline}", widgets=[${widgetTypes}]. Waiting for the user to name players or pick a follow-up chip. When they reply with clear names, call tools and return a FULL stats/comparison JSON page — never invent stats.]`
        : `[Page rendered: layout=${data.layout ?? 'generic'}, title="${data.title || summary.headline}", widgets=[${widgetTypes}]. For a NEW player/match/stats ask with clear names, call tools and return full JSON with widgets again. If the ask is vague (e.g. "other legends"), clarify with follow_up_chips instead of inventing players.]`;
      setHistory((prev) => [...prev, { role: 'assistant', content: stub }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                error: msg,
                page: {
                  layout: 'generic',
                  title: 'Unable to load',
                  ai_summary: { headline: 'Error', text: msg },
                  widgets: [],
                },
              }
            : t,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const hasTurns = turns.length > 0;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      <header className="z-10 shrink-0 border-b border-sky-200/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-2">
              CricInsights
            </p>
            <h1 className="display mt-1 text-2xl text-ink sm:text-3xl">
              Cricket Analytics
            </h1>
            <p className="mt-1 max-w-xl text-xs text-ink-dim sm:text-sm">
              {hasTurns
                ? 'Scroll the thread for earlier answers — each card is a full analytics page.'
                : 'Ask below — answers stack as full-width cards with widgets.'}
            </p>
          </div>
          {hasTurns ? (
            <button
              type="button"
              onClick={clearChat}
              disabled={loading}
              className="glass shrink-0 rounded-xl px-3 py-2 text-xs font-medium text-ink transition hover:border-[var(--danger)]/40 hover:text-[var(--danger)] disabled:opacity-40"
              title="Clear all answers and start fresh"
            >
              Clear chat
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="thread-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-36 sm:px-6">
          {!hasTurns && !loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-start gap-6 py-8"
            >
              <p className="max-w-lg text-ink-dim">
                Ask about players, comparisons, leaderboards, or match overs /
                partnerships. Each answer is a full analytics card you can scroll
                back to.
              </p>
              <div className="flex flex-wrap gap-2">
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
            </motion.div>
          ) : null}

          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="w-full min-w-0"
              >
                {turn.page || turn.error ? (
                  <AnswerCard turn={turn} onFollowUp={(prompt) => void send(prompt)} />
                ) : (
                  <div className="answer-card w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/15 bg-[rgba(8,20,32,0.45)] px-4 py-4 sm:px-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-accent-2">
                      You asked
                    </p>
                    <p className="mt-1 mb-4 break-words text-sm text-ink">
                      {turn.query}
                    </p>
                    <SkeletonCard />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="command-bar glass-strong absolute inset-x-0 bottom-0 z-20 border-t border-sky-200/15 px-4 py-3 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
          {error ? (
            <p className="text-xs text-[var(--danger)]">{error}</p>
          ) : null}
          <div className="flex min-w-0 gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask cricket — players, match overs, partnerships, tables…"
              className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-ink-dim/70 focus:border-sky-300/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-2xl bg-gradient-to-br from-teal-300 to-sky-400 px-5 py-3 text-sm font-semibold text-[#031018] disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
