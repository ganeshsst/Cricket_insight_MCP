import { z } from 'zod';

const statChipSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

const playerHeroSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  imageUrl: z.string().nullable().optional(),
  subtitle: z.string().optional(),
  chips: z.array(statChipSchema).optional(),
});

const chartPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const uiComponentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('player_hero'), player: playerHeroSchema }),
  z.object({
    type: z.literal('duel_stage'),
    playerA: playerHeroSchema,
    playerB: playerHeroSchema,
  }),
  z.object({
    type: z.literal('bar_chart'),
    title: z.string().optional(),
    metric: z.string(),
    values: z.array(chartPointSchema),
  }),
  z.object({
    type: z.literal('line_chart'),
    title: z.string().optional(),
    metric: z.string(),
    values: z.array(chartPointSchema),
  }),
  z.object({
    type: z.literal('radar_chart'),
    title: z.string().optional(),
    data: z.array(
      z.object({ label: z.string(), value: z.number() }),
    ),
    players: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('stats_table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
  z.object({
    type: z.literal('podium'),
    title: z.string().optional(),
    entries: z.array(
      z.object({
        rank: z.number(),
        name: z.string(),
        imageUrl: z.string().nullable().optional(),
        value: z.union([z.string(), z.number()]),
        metric: z.string().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('follow_up_chips'),
    prompts: z.array(z.string()),
  }),
]);

export const chatResponseSchema = z.object({
  text: z.string(),
  ui: z.array(uiComponentSchema).optional(),
});

export type ParsedChatResponse = z.infer<typeof chatResponseSchema>;
