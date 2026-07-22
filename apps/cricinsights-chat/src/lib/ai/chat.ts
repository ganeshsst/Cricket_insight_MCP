import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, stepCountIs } from 'ai';
import { buildBedrockUsageMeta } from '@/lib/ai/bedrock-usage';
import { SYSTEM_PROMPT } from '@/lib/ai/prompt';
import { parseModelJson, sanitizeUi } from '@/lib/ai/hydrate';
import { fillUiFromToolResults } from '@/lib/ai/hydrate-from-tools';
import { buildAiTools } from '@/lib/mcp/ai-tools';
import { stripInlineMarkdown } from '@/lib/utils';
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
    return `${ASSISTANT_STUB_PREFIX} prior JSON page was shown. For a NEW clear player/match/stats ask, call tools and return full page JSON. If vague (legends/others/best seasons without names), clarify with follow_up_chips — never invent.]`;
  }
  if (trimmed.length > 60) {
    return `${ASSISTANT_STUB_PREFIX} prior cricket page was shown (summary only in history). Clear named asks → tools + full JSON widgets. Vague asks → clarify page with follow_up_chips, no invented stats.]`;
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

  const toolNames = (result.toolResults ?? []).map(
    (t) => (t as { toolName?: string }).toolName,
  );
  const modelMetricTitles = (parsed.ui ?? [])
    .filter((w) => w.type === 'metric_duel')
    .map((w) => (w.type === 'metric_duel' ? w.title : null));
  const finalMetricTitles = (withTools.ui ?? [])
    .filter((w) => w.type === 'metric_duel')
    .map((w) => (w.type === 'metric_duel' ? w.title : null));

  console.log('[cricinsights ui source]', {
    uiSource,
    modelUiCount,
    finalUiCount,
    modelWidgetTypes: (parsed.ui ?? []).map((w) => w.type),
    finalWidgetTypes: (withTools.ui ?? []).map((w) => w.type),
    toolNames,
    layout: withTools.layout,
    title: withTools.title,
  });

  // #region agent log
  fetch('http://127.0.0.1:7887/ingest/7edc790d-29f3-447f-b728-46811f18af44',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8849f'},body:JSON.stringify({sessionId:'d8849f',location:'chat.ts:runCricChat:postHydrate',message:'chat hydrate summary',data:{uiSource,modelUiCount,finalUiCount,toolNames,calledMatchup:toolNames.includes('get_batter_bowler_matchup'),calledCompare:toolNames.includes('compare_players_by_name'),modelMetricTitles,finalMetricTitles,hasH2HInFinal:finalMetricTitles.some(t=>t&&/head-to-head|h2h|matchup/i.test(t))},timestamp:Date.now(),hypothesisId:'A,B,D'})}).catch(()=>{});
  // #endregion

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const usageMeta = buildBedrockUsageMeta(
    modelId,
    inputTokens,
    outputTokens,
    result.steps.length,
  );

  console.log('[cricinsights bedrock usage]', usageMeta);

  const text =
    withTools.text?.trim() ||
    withTools.ai_summary?.text?.trim() ||
    'I could not produce a clear answer. Try rephrasing your cricket question.';

  return {
    layout: withTools.layout,
    title: stripInlineMarkdown(
      withTools.title?.trim() || withTools.ai_summary?.headline || 'CricInsights',
    ),
    text,
    ai_summary: {
      headline:
        withTools.ai_summary.headline || withTools.title || 'Insight',
      text: withTools.ai_summary.text || text,
    },
    ui: withTools.ui ? sanitizeUi(withTools.ui) : [],
    meta: usageMeta,
  };
}
