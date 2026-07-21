export type StatChip = {
  label: string;
  value: string | number;
};

export type PlayerHeroData = {
  id?: string;
  name: string;
  imageUrl: string | null;
  subtitle?: string;
  chips?: StatChip[];
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type RadarPoint = {
  label: string;
  value: number;
};

export type PodiumEntry = {
  rank: number;
  name: string;
  imageUrl: string | null;
  value: string | number;
  metric?: string;
};

export type LayoutType =
  | 'player_profile'
  | 'player_comparison'
  | 'team_profile'
  | 'tournament'
  | 'venue'
  | 'match_snapshot'
  | 'generic';

export type OverBar = {
  over: number;
  runs: number;
  wickets?: number;
  bowler?: string;
};

export type PartnershipRow = {
  players: string;
  runs: number;
  balls?: number;
  wicketNumber?: number;
};

export type MatchHeaderData = {
  title: string;
  subtitle?: string;
  status?: string;
  scoreLine?: string;
  venue?: string;
};

export type ScorecardBatter = {
  name: string;
  runs: number | string;
  balls?: number | string;
  dismissal?: string;
};

export type ScorecardBowler = {
  name: string;
  overs: number | string;
  maidens?: number | string;
  runs: number | string;
  wickets: number | string;
  economy?: number | string;
};

export type ComparisonEntity = {
  name: string;
  imageUrl?: string | null;
  subtitle?: string;
  stats: Record<string, string | number>;
};

export type MetricDuelRow = {
  metric: string;
  valueA: string | number;
  valueB: string | number;
  /** Which side is stronger for this metric; omit or none when not comparable. */
  winner?: 'a' | 'b' | 'tie' | 'none';
};

export type UIComponent =
  | { type: 'text'; content: string }
  | { type: 'player_hero'; player: PlayerHeroData }
  | { type: 'duel_stage'; playerA: PlayerHeroData; playerB: PlayerHeroData }
  | {
      type: 'comparison_table';
      title?: string;
      entities: ComparisonEntity[];
      metrics?: string[];
    }
  | {
      type: 'metric_duel';
      title?: string;
      labelA?: string;
      labelB?: string;
      rows: MetricDuelRow[];
      insight?: string;
    }
  | {
      type: 'bar_chart';
      title?: string;
      metric: string;
      values: ChartPoint[];
      insight?: string;
    }
  | {
      type: 'line_chart';
      title?: string;
      metric: string;
      values: ChartPoint[];
      insight?: string;
    }
  | {
      type: 'radar_chart';
      title?: string;
      data: RadarPoint[];
      players?: string[];
      insight?: string;
    }
  | {
      type: 'manhattan_chart';
      title?: string;
      innings: { label: string; overs: OverBar[] }[];
      insight?: string;
    }
  | {
      type: 'partnerships';
      title?: string;
      rows: PartnershipRow[];
      insight?: string;
    }
  | {
      type: 'match_header';
      match: MatchHeaderData;
    }
  | {
      type: 'scorecard_mini';
      title?: string;
      batting?: ScorecardBatter[];
      bowling?: ScorecardBowler[];
      note?: string;
    }
  | {
      type: 'stats_table';
      headers: string[];
      rows: (string | number)[][];
    }
  | {
      type: 'podium';
      title?: string;
      entries: PodiumEntry[];
    }
  | {
      type: 'ai_insights';
      headline: string;
      text: string;
    }
  | {
      type: 'follow_up_chips';
      prompts: string[];
    };

export type AiSummary = {
  headline: string;
  text: string;
};

export type BedrockUsageMeta = {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  steps: number;
  costUsd: number;
  costFormatted: string;
  inputPricePerM: number;
  outputPricePerM: number;
};

/** Normalized page response for the command-bar UI. */
export type CricInsightsResponse = {
  layout: LayoutType;
  title: string;
  text: string;
  ai_summary: AiSummary;
  ui: UIComponent[];
  /** Bedrock token usage + estimated cost (does not affect model output). */
  meta?: BedrockUsageMeta;
};
