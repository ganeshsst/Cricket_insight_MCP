import type {
  CricInsightsResponse,
  UIComponent,
} from '@/types/generative-ui';
import { resolvePlayerPhoto } from '@/lib/utils';
import { chatResponseSchema } from '@/lib/ai/schema';

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

/** Parse model JSON; invalid UI entries are dropped via schema. */
export function parseModelJson(text: string): CricInsightsResponse {
  const trimmed = text
    .replace(/<\/?no_tool>/gi, '')
    .replace(/<\/?tool_call>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { text: trimmed || '', ui: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = chatResponseSchema.safeParse({
      text: typeof parsed.text === 'string' ? parsed.text : trimmed,
      ui: Array.isArray(parsed.ui)
        ? parsed.ui
        : parsed.ui
          ? [parsed.ui]
          : [],
    });
    if (result.success) {
      return {
        text: result.data.text,
        ui: result.data.ui
          ? sanitizeUi(result.data.ui as UIComponent[])
          : [],
      };
    }
  } catch {
    /* fall through */
  }

  return { text: trimmed, ui: [] };
}
