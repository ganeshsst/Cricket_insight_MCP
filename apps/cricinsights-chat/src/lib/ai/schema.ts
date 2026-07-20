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

const overBarSchema = z.object({
  over: z.number(),
  runs: z.number(),
  wickets: z.number().optional(),
  bowler: z.string().optional(),
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
    type: z.literal('comparison_table'),
    title: z.string().optional(),
    entities: z.array(
      z.object({
        name: z.string(),
        imageUrl: z.string().nullable().optional(),
        subtitle: z.string().optional(),
        stats: z.record(z.string(), z.union([z.string(), z.number()])),
      }),
    ),
    metrics: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('bar_chart'),
    title: z.string().optional(),
    metric: z.string(),
    values: z.array(chartPointSchema),
    insight: z.string().optional(),
  }),
  z.object({
    type: z.literal('line_chart'),
    title: z.string().optional(),
    metric: z.string(),
    values: z.array(chartPointSchema),
    insight: z.string().optional(),
  }),
  z.object({
    type: z.literal('radar_chart'),
    title: z.string().optional(),
    data: z.array(z.object({ label: z.string(), value: z.number() })),
    players: z.array(z.string()).optional(),
    insight: z.string().optional(),
  }),
  z.object({
    type: z.literal('manhattan_chart'),
    title: z.string().optional(),
    innings: z.array(
      z.object({
        label: z.string(),
        overs: z.array(overBarSchema),
      }),
    ),
    insight: z.string().optional(),
  }),
  z.object({
    type: z.literal('partnerships'),
    title: z.string().optional(),
    rows: z.array(
      z.object({
        players: z.string(),
        runs: z.number(),
        balls: z.number().optional(),
        wicketNumber: z.number().optional(),
      }),
    ),
    insight: z.string().optional(),
  }),
  z.object({
    type: z.literal('match_header'),
    match: z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      status: z.string().optional(),
      scoreLine: z.string().optional(),
      venue: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('scorecard_mini'),
    title: z.string().optional(),
    batting: z
      .array(
        z.object({
          name: z.string(),
          runs: z.union([z.string(), z.number()]),
          balls: z.union([z.string(), z.number()]).optional(),
          dismissal: z.string().optional(),
        }),
      )
      .default([]),
    bowling: z
      .array(
        z.object({
          name: z.string(),
          overs: z.union([z.string(), z.number()]),
          maidens: z.union([z.string(), z.number()]).optional(),
          runs: z.union([z.string(), z.number()]),
          wickets: z.union([z.string(), z.number()]),
          economy: z.union([z.string(), z.number()]).optional(),
        }),
      )
      .optional(),
    note: z.string().optional(),
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
    type: z.literal('ai_insights'),
    headline: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('follow_up_chips'),
    prompts: z.array(z.string()),
  }),
]);

const layoutSchema = z.enum([
  'player_profile',
  'player_comparison',
  'team_profile',
  'tournament',
  'venue',
  'match_snapshot',
  'generic',
]);

const aiSummarySchema = z.object({
  headline: z.string(),
  text: z.string(),
});

/** Accepts new page shape and legacy { text, ui }.
 * Widgets are unknown[] here so one bad widget does not fail the whole page —
 * hydrate validates each widget individually.
 */
export const chatResponseSchema = z
  .object({
    layout: layoutSchema.optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    ai_summary: z.union([aiSummarySchema, z.string()]).optional(),
    widgets: z.array(z.unknown()).optional(),
    ui: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type ParsedChatResponse = z.infer<typeof chatResponseSchema>;
