import { NextResponse } from 'next/server';
import { runCricChat } from '@/lib/ai/chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as {
      messages: { role: 'user' | 'assistant'; content: string }[];
    };
    const result = await runCricChat(messages ?? []);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { text: `Unable to process request. ${detail}` },
      { status: 500 },
    );
  }
}
