import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { runCricChat } from '@/lib/cricinsights/ai/chat';
import {
  addMessage,
  createChat,
  updateChatTitle,
  upsertProfile,
} from '@/lib/cricinsights/history-api';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    const email =
      typeof session.user.email === 'string' ? session.user.email : undefined;
    const displayName =
      typeof session.user.name === 'string' ? session.user.name : undefined;
    const avatarUrl =
      typeof session.user.picture === 'string'
        ? session.user.picture
        : undefined;

    // History persistence is best-effort until a read/write DB role is configured.
    try {
      await upsertProfile({ userId, email, displayName, avatarUrl });
    } catch (err) {
      console.warn('[cric/chat] profile upsert skipped:', err);
    }

    const body = (await req.json()) as {
      messages?: { role: 'user' | 'assistant'; content: string }[];
      chatId?: string;
    };

    const messages = body.messages ?? [];
    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let chatId = body.chatId;

    if (!chatId) {
      try {
        const title = (lastUser?.content ?? 'New chat').slice(0, 80);
        const chat = await createChat(userId, title);
        chatId = chat.id;
      } catch (err) {
        console.warn('[cric/chat] createChat skipped:', err);
      }
    }

    if (lastUser?.content && chatId) {
      try {
        await addMessage(chatId, {
          userId,
          role: 'user',
          content: lastUser.content,
        });
      } catch (err) {
        console.warn('[cric/chat] add user message skipped:', err);
      }
    }

    const result = await runCricChat(messages);

    if (chatId) {
      try {
        await addMessage(chatId, {
          userId,
          role: 'assistant',
          content: result.ai_summary?.headline ?? result.title ?? 'Insight',
          pageJson: result,
        });
      } catch (err) {
        console.warn('[cric/chat] add assistant message skipped:', err);
      }
    }

    if (lastUser?.content && chatId) {
      try {
        await updateChatTitle(chatId, userId, lastUser.content.slice(0, 80));
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ ...result, chatId });
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { text: `Unable to process request. ${detail}` },
      { status: 500 },
    );
  }
}
