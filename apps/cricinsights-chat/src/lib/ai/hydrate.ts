import type {
  AiSummary,
  CricInsightsResponse,
  LayoutType,
  UIComponent,
} from '@/types/generative-ui';
import { resolvePlayerPhoto } from '@/lib/utils';
import { chatResponseSchema, uiComponentSchema } from '@/lib/ai/schema';

/** Fix image URLs only — does not invent widgets or text. */
export function sanitizeUi(ui: UIComponent[]): UIComponent[] {
  return ui.map((item) => {
    if (item.type === 'player_hero') {
      return {
        ...item,
        player: {
          ...item.player,
          imageUrl: resolvePlayerPhoto(item.player.imageUrl, item.player.name),
        },
      };
    }
    if (item.type === 'duel_stage') {
      return {
        ...item,
        playerA: {
          ...item.playerA,
          imageUrl: resolvePlayerPhoto(
            item.playerA.imageUrl,
            item.playerA.name,
          ),
        },
        playerB: {
          ...item.playerB,
          imageUrl: resolvePlayerPhoto(
            item.playerB.imageUrl,
            item.playerB.name,
          ),
        },
      };
    }
    if (item.type === 'comparison_table') {
      return {
        ...item,
        entities: item.entities.map((e) => ({
          ...e,
          imageUrl: resolvePlayerPhoto(e.imageUrl, e.name),
        })),
      };
    }
    if (item.type === 'podium') {
      return {
        ...item,
        entries: item.entries.map((e) => ({
          ...e,
          imageUrl: resolvePlayerPhoto(e.imageUrl, e.name),
        })),
      };
    }
    return item;
  });
}

function normalizeSummary(raw: unknown, fallbackText: string): AiSummary {
  if (raw && typeof raw === 'object' && 'text' in (raw as object)) {
    const s = raw as { headline?: string; text?: string };
    return {
      headline: stripPlanning((s.headline ?? 'Insight').trim()) || 'Insight',
      text: stripPlanning((s.text ?? fallbackText).trim()) || fallbackText,
    };
  }
  if (typeof raw === 'string' && raw.trim()) {
    return { headline: 'Insight', text: stripPlanning(raw.trim()) };
  }
  return {
    headline: 'Insight',
    text: stripPlanning(fallbackText) || 'No summary available.',
  };
}

function guessLayout(widgets: UIComponent[]): LayoutType {
  const types = new Set(widgets.map((w) => w.type));
  if (
    types.has('manhattan_chart') ||
    types.has('match_header') ||
    types.has('partnerships')
  ) {
    return 'match_snapshot';
  }
  if (types.has('comparison_table') || types.has('duel_stage')) {
    return 'player_comparison';
  }
  if (types.has('player_hero')) return 'player_profile';
  if (types.has('podium')) return 'tournament';
  return 'generic';
}

/** Remove model self-talk / planning sentences from summaries. */
function stripPlanning(text: string): string {
  if (!text) return text;
  // If the whole blob is JSON, don't use it as summary prose
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"widgets"')) {
    return '';
  }
  const lines = trimmed.split(/\n+/);
  const kept = lines.filter((line) => {
    const l = line.trim().toLowerCase();
    if (!l) return false;
    if (l.startsWith('{') || l.startsWith('[')) return false;
    if (l.includes('i now have')) return false;
    if (l.includes('i can now create')) return false;
    if (l.includes('i need to correct')) return false;
    if (l.includes('i will now')) return false;
    if (l.includes('let me create')) return false;
    if (l.includes('mix-up in the team')) return false;
    if (l.startsWith('```')) return false;
    return true;
  });
  return kept.join('\n').trim();
}

function looksLikePageObject(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o.widgets) ||
    Array.isArray(o.ui) ||
    typeof o.layout === 'string' ||
    (o.ai_summary != null && typeof o.ai_summary === 'object')
  );
}

/** Prefer the JSON object that looks like a page (has widgets/layout). */
function extractJsonObjects(text: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const slice = text.slice(i, j + 1);
          try {
            const parsed = JSON.parse(slice) as unknown;
            if (parsed && typeof parsed === 'object') {
              objects.push(parsed as Record<string, unknown>);
            }
          } catch {
            /* skip */
          }
          i = j;
          break;
        }
      }
    }
  }
  return objects;
}

function pickBestPageObject(
  objects: Record<string, unknown>[],
): Record<string, unknown> | null {
  if (!objects.length) return null;
  const scored = objects.map((o) => {
    let score = 0;
    if (Array.isArray(o.widgets)) score += 10 + o.widgets.length;
    if (Array.isArray(o.ui)) score += 10 + o.ui.length;
    if (typeof o.layout === 'string') score += 3;
    if (typeof o.title === 'string') score += 2;
    if (o.ai_summary) score += 2;
    // Penalize wrappers that only embed JSON in text
    if (
      typeof o.text === 'string' &&
      o.text.includes('"widgets"') &&
      !Array.isArray(o.widgets) &&
      !Array.isArray(o.ui)
    ) {
      score -= 5;
    }
    return { o, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.o ?? null;
}

/** Coerce common small-model mistakes into valid widget shapes. */
function coerceWidget(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const w = { ...(raw as Record<string, unknown>) };

  if (w.type === 'duel_stage') {
    const toHero = (v: unknown) => {
      if (v && typeof v === 'object' && 'name' in (v as object)) return v;
      if (typeof v === 'string') {
        return { name: v, imageUrl: null };
      }
      return v;
    };
    w.playerA = toHero(w.playerA);
    w.playerB = toHero(w.playerB);
  }

  // manhattan as bar_chart-like mistake
  if (w.type === 'manhattan_chart' && !Array.isArray(w.innings) && Array.isArray(w.values)) {
    const values = w.values as unknown[];
    const innings: { label: string; overs: unknown[] }[] = [];
    for (const v of values) {
      if (v && typeof v === 'object') {
        const row = v as Record<string, unknown>;
        if (Array.isArray(row.value)) {
          innings.push({
            label: typeof row.label === 'string' ? row.label : 'Innings',
            overs: row.value,
          });
        } else if (
          typeof row.over === 'number' ||
          typeof row.runs === 'number'
        ) {
          // flat list of overs — stash and wrap later
        }
      }
    }
    if (innings.length) {
      w.innings = innings;
      delete w.values;
      delete w.metric;
    } else if (
      values.every(
        (v) =>
          v &&
          typeof v === 'object' &&
          ('over' in (v as object) || 'runs' in (v as object)),
      )
    ) {
      w.innings = [{ label: 'Innings', overs: values }];
      delete w.values;
      delete w.metric;
    }
  }

  return w;
}

function parseWidgets(rawWidgets: unknown[]): UIComponent[] {
  const valid: UIComponent[] = [];
  for (const w of rawWidgets) {
    const coerced = coerceWidget(w);
    const checked = uiComponentSchema.safeParse(coerced);
    if (checked.success) {
      valid.push(checked.data as UIComponent);
    }
  }
  return valid;
}

function pageFromObject(parsed: Record<string, unknown>): CricInsightsResponse | null {
  const soft = {
    ...parsed,
    widgets: Array.isArray(parsed.widgets) ? parsed.widgets : undefined,
    ui: Array.isArray(parsed.ui) ? parsed.ui : undefined,
  };

  const result = chatResponseSchema.safeParse(soft);
  if (!result.success && !looksLikePageObject(parsed)) {
    return null;
  }

  type SoftPage = {
    layout?: LayoutType;
    title?: string;
    text?: string;
    ai_summary?: unknown;
    widgets?: unknown[];
    ui?: unknown[];
  };

  const data: SoftPage = result.success
    ? (result.data as SoftPage)
    : (soft as SoftPage);

  const rawWidgets = (data.widgets ?? data.ui ?? []) as unknown[];
  let ui = sanitizeUi(parseWidgets(rawWidgets));

  // Unwrap: page JSON embedded as string in text / ai_summary
  if (!ui.length) {
    const summaryObj =
      data.ai_summary && typeof data.ai_summary === 'object'
        ? (data.ai_summary as { text?: string })
        : null;
    const candidates = [
      typeof data.text === 'string' ? data.text : '',
      typeof data.ai_summary === 'string' ? data.ai_summary : '',
      typeof summaryObj?.text === 'string' ? summaryObj.text : '',
    ].filter(Boolean);

    for (const blob of candidates) {
      const nested = pickBestPageObject(extractJsonObjects(blob));
      if (nested && looksLikePageObject(nested)) {
        const inner = pageFromObject(nested);
        if (inner && inner.ui.length) return inner;
      }
    }
  }

  let summaryText =
    (typeof data.text === 'string' && stripPlanning(data.text)) ||
    (typeof data.ai_summary === 'string' ? stripPlanning(data.ai_summary) : '') ||
    '';

  const ai_summary = normalizeSummary(data.ai_summary, summaryText);
  if (!ai_summary.text && summaryText) {
    ai_summary.text = summaryText;
  }
  if (
    (!ai_summary.text || ai_summary.text.length < 20) &&
    typeof data.text === 'string' &&
    data.text.includes('"ai_summary"')
  ) {
    const nested = pickBestPageObject(extractJsonObjects(data.text));
    if (nested?.ai_summary) {
      const ns = normalizeSummary(nested.ai_summary, '');
      if (ns.text) {
        ai_summary.headline = ns.headline;
        ai_summary.text = ns.text;
      }
    }
  }

  const title =
    (typeof data.title === 'string' &&
    data.title.trim() &&
    data.title !== 'CricInsights'
      ? data.title.trim()
      : '') ||
    (ai_summary.headline !== 'Insight' ? ai_summary.headline : '') ||
    'CricInsights';

  const layout = data.layout ?? guessLayout(ui);

  if (!ai_summary.text && ui.length) {
    ai_summary.text = 'See widgets below for details.';
  }

  return {
    layout,
    title,
    text: ai_summary.text,
    ai_summary,
    ui,
  };
}

/** Parse model JSON; invalid UI entries are dropped; nested page JSON is unwrapped. */
export function parseModelJson(text: string): CricInsightsResponse {
  const trimmed = text
    .replace(/<\/?no_tool>/gi, '')
    .replace(/<\/?tool_call>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/<\/?thinking>/gi, '')
    .trim();

  const empty: CricInsightsResponse = {
    layout: 'generic',
    title: 'CricInsights',
    text: stripPlanning(trimmed) || trimmed || '',
    ai_summary: {
      headline: 'Insight',
      text: stripPlanning(trimmed) || 'Could not build a page from the model response.',
    },
    ui: [],
  };

  const objects = extractJsonObjects(trimmed);
  const best = pickBestPageObject(objects);
  if (!best) return empty;

  try {
    const page = pageFromObject(best);
    if (!page) return empty;
    // If still no widgets but we have other JSON candidates, try them
    if (!page.ui.length && objects.length > 1) {
      for (const o of objects) {
        if (o === best) continue;
        const alt = pageFromObject(o);
        if (alt && alt.ui.length) return alt;
      }
    }
    return page;
  } catch {
    return empty;
  }
}
