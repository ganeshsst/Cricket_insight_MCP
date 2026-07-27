import { mutate, preload } from 'swr';
import type { CricInsightsResponse, LayoutType, UIComponent } from '@/types/generative-ui';

/** Max fully-hydrated chats kept in the SWR in-memory cache (LRU). */
export const CHAT_CACHE_LIMIT = 10;

export type ChatDetailMessage = {
  role: string;
  content: string | null;
  pageJson: CricInsightsResponse | null;
};

export type ChatDetailResponse = {
  chat?: { id: string; title: string | null };
  messages: ChatDetailMessage[];
};

export type CachedTurn = {
  id: string;
  query: string;
  page: {
    layout: LayoutType;
    title: string;
    ai_summary: { headline: string; text: string };
    widgets: UIComponent[];
  } | null;
};

export type CachedHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function chatHistoryKey(chatId: string) {
  return `/api/cric/history?chatId=${encodeURIComponent(chatId)}`;
}

export async function fetchChatDetail(key: string): Promise<ChatDetailResponse> {
  const res = await fetch(key);
  if (!res.ok) {
    throw new Error('Failed to load chat');
  }
  return res.json() as Promise<ChatDetailResponse>;
}

/** Recency-ordered chat ids currently held in the SWR cache (oldest → newest). */
const lruOrder: string[] = [];

function chatIdFromKey(key: string): string | null {
  try {
    const q = key.includes('?') ? key.slice(key.indexOf('?')) : '';
    return new URLSearchParams(q).get('chatId');
  } catch {
    return null;
  }
}

/**
 * Mark a chat as most-recently used. Evict oldest entries beyond CHAT_CACHE_LIMIT
 * from the SWR cache (in-memory only).
 */
export async function touchChatLru(chatId: string) {
  const idx = lruOrder.indexOf(chatId);
  if (idx >= 0) lruOrder.splice(idx, 1);
  lruOrder.push(chatId);

  while (lruOrder.length > CHAT_CACHE_LIMIT) {
    const evictId = lruOrder.shift();
    if (!evictId) break;
    const key = chatHistoryKey(evictId);
    // Drop cached payload; do not revalidate.
    await mutate(key, undefined, { revalidate: false });
  }
}

/** Warm SWR cache on sidebar hover (no UI update required). */
export async function prefetchChat(chatId: string) {
  const key = chatHistoryKey(chatId);
  await preload(key, fetchChatDetail);
  await touchChatLru(chatId);
}

/** Load chat detail via SWR cache (instant if warm). */
export async function loadChatDetail(
  chatId: string,
  options?: { revalidate?: boolean },
): Promise<ChatDetailResponse> {
  const key = chatHistoryKey(chatId);
  const data = await mutate(key, fetchChatDetail(key), {
    revalidate: options?.revalidate ?? false,
    populateCache: true,
  });
  if (!data) {
    throw new Error('Failed to load chat');
  }
  await touchChatLru(chatId);
  return data;
}

/** After sending a message, refresh that chat’s cache so next open is fresh. */
export async function invalidateChat(chatId: string | null | undefined) {
  if (!chatId) return;
  const key = chatHistoryKey(chatId);
  await mutate(key, fetchChatDetail(key), {
    revalidate: false,
    populateCache: true,
  });
  await touchChatLru(chatId);
}

export function messagesToViewState(messages: ChatDetailMessage[]): {
  turns: CachedTurn[];
  history: CachedHistoryMessage[];
} {
  const turns: CachedTurn[] = [];
  const history: CachedHistoryMessage[] = [];
  let pendingQuery = '';

  for (const m of messages ?? []) {
    if (m.role === 'user') {
      pendingQuery = m.content ?? '';
      history.push({ role: 'user', content: pendingQuery });
    } else if (m.role === 'assistant') {
      const pageJson = m.pageJson;
      const page = pageJson
        ? {
            layout: (pageJson.layout ?? 'generic') as LayoutType,
            title: pageJson.title ?? m.content ?? 'Insight',
            ai_summary: pageJson.ai_summary ?? {
              headline: m.content ?? 'Insight',
              text: '',
            },
            widgets: pageJson.ui ?? [],
          }
        : null;
      turns.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        query: pendingQuery || 'Previous question',
        page,
      });
      history.push({
        role: 'assistant',
        content: '[Page rendered: prior cricket page]',
      });
      pendingQuery = '';
    }
  }

  return { turns, history };
}

/** @internal test helper */
export function _resetChatLruForTests() {
  lruOrder.length = 0;
}

export function _lruOrderForTests() {
  return [...lruOrder];
}

export function _chatIdFromKeyForTests(key: string) {
  return chatIdFromKey(key);
}
