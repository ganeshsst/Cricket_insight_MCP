import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  createChat,
  getChat,
  listChats,
  upsertProfile,
} from '@/lib/cricinsights/history-api';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    try {
      await upsertProfile({
        userId,
        email:
          typeof session.user.email === 'string' ? session.user.email : undefined,
        displayName:
          typeof session.user.name === 'string' ? session.user.name : undefined,
        avatarUrl:
          typeof session.user.picture === 'string'
            ? session.user.picture
            : undefined,
      });
    } catch (err) {
      console.warn('[cric/history] profile upsert skipped:', err);
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (chatId) {
      try {
        const detail = await getChat(chatId, userId);
        return NextResponse.json(detail);
      } catch (err) {
        console.warn('[cric/history] getChat failed:', err);
        return NextResponse.json({ chat: null, messages: [] });
      }
    }

    try {
      const { chats } = await listChats(userId);
      return NextResponse.json({ chats });
    } catch (err) {
      console.warn('[cric/history] listChats failed:', err);
      return NextResponse.json({ chats: [] });
    }
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const chat = await createChat(session.user.sub, 'New chat');
    return NextResponse.json(chat);
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
