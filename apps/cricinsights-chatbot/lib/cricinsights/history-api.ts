const API_BASE = process.env.CRICKET_API_URL ?? 'http://localhost:3001';

export type ChatSummary = {
  id: string;
  userId: string;
  title: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRow = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string | null;
  pageJson: unknown;
  createdAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat history API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function upsertProfile(input: {
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  return api('/chat-history/profiles', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listChats(userId: string) {
  return api<{ chats: ChatSummary[] }>(
    `/chat-history/chats?userId=${encodeURIComponent(userId)}`,
  );
}

export function createChat(userId: string, title?: string) {
  return api<ChatSummary>('/chat-history/chats', {
    method: 'POST',
    body: JSON.stringify({ userId, title }),
  });
}

export function getChat(chatId: string, userId: string) {
  return api<{ chat: ChatSummary; messages: ChatMessageRow[] }>(
    `/chat-history/chats/${chatId}?userId=${encodeURIComponent(userId)}`,
  );
}

export function addMessage(
  chatId: string,
  input: {
    userId: string;
    role: 'user' | 'assistant';
    content?: string;
    pageJson?: unknown;
  },
) {
  return api(`/chat-history/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateChatTitle(
  chatId: string,
  userId: string,
  title: string,
) {
  return api(`/chat-history/chats/${chatId}`, {
    method: 'PUT',
    body: JSON.stringify({ userId, title }),
  });
}
