import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, stepCountIs } from 'ai';
import { SYSTEM_PROMPT } from '@/lib/ai/prompt';
import { parseModelJson, sanitizeUi } from '@/lib/ai/hydrate';
import { fillUiFromToolResults } from '@/lib/ai/hydrate-from-tools';
import { buildAiTools } from '@/lib/mcp/ai-tools';
import type { CricInsightsResponse } from '@/types/generative-ui';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const ASSISTANT_STUB_PREFIX = '[Page rendered:';

function hasBedrockCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SESSION_TOKEN ||
      process.env.AWS_BEARER_TOKEN_BEDROCK,
  );
}

/** Long prose assistant turns teach the model to skip widgets — collapse them. */
function normalizeAssistantForModel(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith(ASSISTANT_STUB_PREFIX)) return trimmed;
  if (trimmed.startsWith('{') && trimmed.includes('"widgets"')) {
    return `${ASSISTANT_STUB_PREFIX} prior JSON page was shown. For a NEW player/match/stats ask, call tools and return full page JSON with widgets again.]`;
  }
  if (trimmed.length > 60) {
    return `${ASSISTANT_STUB_PREFIX} prior cricket page was shown to the user (summary only in history). For any NEW player, match, or stats question: call tools and emit full JSON with layout + widgets — never prose-only.]`;
  }
  return trimmed;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((m) => ({
      role: m.role,
      content:
        m.role === 'assistant'
          ? normalizeAssistantForModel(m.content ?? '')
          : (m.content ?? '').trim(),
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
  const modelUiCount = parsed.ui?.length ?? 0;
  const withTools = fillUiFromToolResults(parsed, result.toolResults);
  const finalUiCount = withTools.ui?.length ?? 0;

  const uiSource =
    modelUiCount > 0
      ? 'model_response'
      : finalUiCount > 0
        ? 'hydrate_from_tools'
        : 'none';

  console.log('[cricinsights ui source]', {
    uiSource,
    modelUiCount,
    finalUiCount,
    modelWidgetTypes: (parsed.ui ?? []).map((w) => w.type),
    finalWidgetTypes: (withTools.ui ?? []).map((w) => w.type),
    toolNames: (result.toolResults ?? []).map(
      (t) => (t as { toolName?: string }).toolName,
    ),
    layout: withTools.layout,
    title: withTools.title,
  });

  const text =
    withTools.text?.trim() ||
    withTools.ai_summary?.text?.trim() ||
    'I could not produce a clear answer. Try rephrasing your cricket question.';

  return {
    layout: withTools.layout,
    title: withTools.title,
    text,
    ai_summary: {
      headline: withTools.ai_summary.headline || withTools.title || 'Insight',
      text: withTools.ai_summary.text || text,
    },
    ui: withTools.ui ? sanitizeUi(withTools.ui) : [],
  };
}
