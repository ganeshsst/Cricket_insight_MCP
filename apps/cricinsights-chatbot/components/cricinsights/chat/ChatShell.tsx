'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSWRConfig } from 'swr';
import { CricketThinking } from '@/components/cricinsights/chat/CricketThinking';
import { GenerativeRenderer } from '@/components/cricinsights/generative/GenerativeRenderer';
import { AiInsightsCard } from '@/components/cricinsights/generative/patterns/MatchWidgets';
import {
  chatHistoryKey,
  invalidateChat,
  loadChatDetail,
  messagesToViewState,
  prefetchChat,
  touchChatLru,
  type ChatDetailResponse,
} from '@/lib/cricinsights/chat-cache';
import type {
  BedrockUsageMeta,
  CricInsightsResponse,
  LayoutType,
  UIComponent,
} from '@/types/generative-ui';

const PREFETCH_HOVER_MS = 150;

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

type SidebarChat = {
  id: string;
  title: string | null;
  updatedAt: string;
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
        <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300/80">
          You asked
        </p>
        <p className="mt-1 break-words text-sm text-zinc-100">{turn.query}</p>
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 py-4 sm:px-5">
        {turn.error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {turn.error}
          </div>
        ) : null}

        {turn.page ? (
          <>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                {turn.page.title}
              </h2>
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
              <p className="border-t border-sky-200/10 pt-3 text-[11px] text-zinc-400">
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

type ChatShellProps = {
  userName?: string | null;
  userPicture?: string | null;
};

export function ChatShell({ userName, userPicture }: ChatShellProps) {
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState<SidebarChat[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cache } = useSWRConfig();

  const applyChatDetail = useCallback((id: string, data: ChatDetailResponse) => {
    const { turns: nextTurns, history: nextHistory } = messagesToViewState(
      data.messages ?? [],
    );
    setChatId(id);
    setTurns(nextTurns as Turn[]);
    setHistory(nextHistory);
    setError(null);
  }, []);

  const refreshSidebar = useCallback(async () => {
    try {
      const res = await fetch('/api/cric/history');
      if (!res.ok) return;
      const data = (await res.json()) as { chats?: SidebarChat[] };
      setChats(data.chats ?? []);
    } catch {
      /* sidebar best-effort until DB is reachable */
    }
  }, []);

  useEffect(() => {
    void refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loading]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  async function startNewChat() {
    if (loading || switching) return;
    setHistory([]);
    setTurns([]);
    setInput('');
    setError(null);
    setChatId(null);
    try {
      const res = await fetch('/api/cric/history', { method: 'POST' });
      if (res.ok) {
        const chat = (await res.json()) as { id: string };
        setChatId(chat.id);
        await refreshSidebar();
      }
    } catch {
      /* local-only new chat is fine */
    }
  }

  function schedulePrefetch(id: string) {
    if (id === chatId) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      void prefetchChat(id).catch(() => {
        /* prefetch is best-effort */
      });
    }, PREFETCH_HOVER_MS);
  }

  function cancelPrefetch() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  async function openChat(id: string) {
    if (loading || switching) return;
    if (id === chatId) return;
    cancelPrefetch();
    setError(null);

    const key = chatHistoryKey(id);
    const cached = cache.get(key)?.data as ChatDetailResponse | undefined;

    // Warm cache (hover prefetch / prior open): use it, no second network call.
    if (cached?.messages) {
      applyChatDetail(id, cached);
      void touchChatLru(id);
      return;
    }

    setSwitching(true);
    try {
      const data = await loadChatDetail(id);
      applyChatDetail(id, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open chat');
    } finally {
      setSwitching(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || switching) return;

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
      const res = await fetch('/api/cric/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId ?? undefined,
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as CricInsightsResponse & {
        text?: string;
        chatId?: string;
      };
      if (!res.ok) {
        throw new Error(data.text || 'Request failed');
      }

      const resolvedChatId = data.chatId ?? chatId;
      if (data.chatId) {
        setChatId(data.chatId);
        void refreshSidebar();
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

      const widgetTypes =
        (data.ui ?? []).map((w) => w.type).join(', ') || 'none';
      const stub = `[Page rendered: layout=${data.layout ?? 'generic'}, title="${data.title || summary.headline}", widgets=[${widgetTypes}].]`;
      setHistory((prev) => [...prev, { role: 'assistant', content: stub }]);

      // Next sidebar open should see the new turn.
      void invalidateChat(resolvedChatId);
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
    <div className="relative flex h-dvh w-full overflow-hidden bg-[#050d14] text-zinc-100">
      <aside
        className={`flex shrink-0 flex-col border-r border-sky-200/10 bg-[#071018] transition-[width] duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sky-200/10 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300/80">
            Chats
          </p>
          <button
            type="button"
            onClick={() => void startNewChat()}
            className="rounded-lg bg-sky-400/15 px-2 py-1 text-xs text-sky-200 hover:bg-sky-400/25"
          >
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-zinc-500">
              No saved chats yet. Ask something to create one.
            </p>
          ) : (
            <ul className="space-y-1">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void openChat(c.id)}
                    onMouseEnter={() => schedulePrefetch(c.id)}
                    onMouseLeave={cancelPrefetch}
                    onFocus={() => schedulePrefetch(c.id)}
                    disabled={switching}
                    className={`w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/5 disabled:opacity-60 ${
                      chatId === c.id
                        ? 'bg-sky-400/15 text-sky-100'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="line-clamp-2">
                      {c.title?.trim() || 'Untitled chat'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-sky-200/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            {userPicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userPicture}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-xs">
                {(userName ?? 'U').slice(0, 1)}
              </div>
            )}
            <p className="truncate text-xs text-zinc-300">
              {userName ?? 'Signed in'}
            </p>
          </div>
          <a
            href="/auth/logout"
            className="block rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            Log out
          </a>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 shrink-0 border-b border-sky-200/10 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="rounded-lg border border-sky-200/15 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
                >
                  {sidebarOpen ? 'Hide' : 'Chats'}
                </button>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-300/80">
                  CricInsights
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Cricket Analytics
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void startNewChat()}
              disabled={loading}
              className="shrink-0 rounded-xl border border-sky-200/15 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-sky-300/40 disabled:opacity-40"
            >
              New chat
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-36 sm:px-6">
            {switching ? (
              <p className="text-xs text-zinc-500">Loading chat…</p>
            ) : null}

            {!hasTurns && !loading && !switching ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-start gap-6 py-8"
              >
                <p className="max-w-lg text-zinc-400">
                  Ask about players, comparisons, leaderboards, or match overs.
                  Answers save to your history after Auth0 login.
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-sky-200/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-sky-300/40"
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
                    <AnswerCard
                      turn={turn}
                      onFollowUp={(prompt) => void send(prompt)}
                    />
                  ) : (
                    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-sky-200/15 bg-[rgba(8,20,32,0.45)] px-4 py-4 sm:px-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300/80">
                        You asked
                      </p>
                      <p className="mt-1 mb-4 break-words text-sm text-zinc-100">
                        {turn.query}
                      </p>
                      <CricketThinking />
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
          className="absolute inset-x-0 bottom-0 z-20 border-t border-sky-200/15 bg-[#071018]/90 px-4 py-3 backdrop-blur-md sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex min-w-0 gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask cricket — players, match overs, partnerships…"
                className="min-w-0 flex-1 rounded-2xl border border-sky-200/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-sky-300/40"
                disabled={loading || switching}
              />
              <button
                type="submit"
                disabled={loading || switching || !input.trim()}
                className="shrink-0 rounded-2xl bg-gradient-to-br from-teal-300 to-sky-400 px-5 py-3 text-sm font-semibold text-[#031018] disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
