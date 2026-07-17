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

export type UIComponent =
  | { type: 'text'; content: string }
  | {
      type: 'player_hero';
      player: PlayerHeroData;
    }
  | {
      type: 'duel_stage';
      playerA: PlayerHeroData;
      playerB: PlayerHeroData;
    }
  | {
      type: 'bar_chart';
      title?: string;
      metric: string;
      values: ChartPoint[];
    }
  | {
      type: 'line_chart';
      title?: string;
      metric: string;
      values: ChartPoint[];
    }
  | {
      type: 'radar_chart';
      title?: string;
      data: RadarPoint[];
      players?: string[];
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
      type: 'follow_up_chips';
      prompts: string[];
    };

export type CricInsightsResponse = {
  text: string;
  ui?: UIComponent[];
};
