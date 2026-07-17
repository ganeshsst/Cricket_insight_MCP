import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, stepCountIs } from 'ai';
import { SYSTEM_PROMPT } from '@/lib/ai/prompt';
import { parseModelJson, sanitizeUi } from '@/lib/ai/hydrate';
import { buildAiTools } from '@/lib/mcp/ai-tools';
import type { CricInsightsResponse } from '@/types/generative-ui';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function hasBedrockCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SESSION_TOKEN ||
      process.env.AWS_BEARER_TOKEN_BEDROCK,
  );
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((m) => ({
      role: m.role,
      content: (m.content ?? '').trim(),
    }))
    .filter((m) => m.content.length > 0);
}

export async function runCricChat(
  messages: ChatMessage[],
): Promise<CricInsightsResponse> {
  if (!hasBedrockCredentials()) {
    throw new Error('Bedrock credentials are not configured.');
  }
  if (!process.env.MCP_SERVER_URL) {
    throw new Error('MCP_SERVER_URL is not configured.');
  }

  const modelId =
    process.env.BEDROCK_MODEL_ID ?? 'nvidia.nemotron-nano-3-30b';
  const history = sanitizeMessages(messages);
  if (history.length === 0) {
    throw new Error('No messages to process.');
  }

  const tools = await buildAiTools({ maxWebSearches: 1 });

  // LLM decides whether to call tools — no regex forcing.
  const result = await generateText({
    model: bedrock(modelId),
    system: SYSTEM_PROMPT,
    messages: history,
    tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(8),
  });

  const parsed = parseModelJson(result.text ?? '');
  const text =
    parsed.text?.trim() ||
    'I could not produce a clear answer. Try rephrasing your cricket question.';

  return {
    text,
    ui: parsed.ui ? sanitizeUi(parsed.ui) : [],
  };
}
