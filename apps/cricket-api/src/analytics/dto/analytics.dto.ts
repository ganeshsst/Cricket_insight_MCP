import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const RANKING_METRICS = [
  'runs',
  'wickets',
  'average',
  'strike_rate',
  'economy',
  'dismissals',
] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

export const RANKING_WINDOWS = ['season', 'career', 'last_n_matches'] as const;
export type RankingWindow = (typeof RANKING_WINDOWS)[number];

export const VS_BOWLING_TYPES = [
  'pace',
  'spin',
  'left_arm_pace',
  'right_arm_pace',
  'left_arm_spin',
  'right_arm_spin',
  'any',
] as const;
export type VsBowlingType = (typeof VS_BOWLING_TYPES)[number];

export const PERFORMANCE_KINDS = ['batting', 'bowling'] as const;
export type PerformanceKind = (typeof PERFORMANCE_KINDS)[number];

export const PERFORMANCE_SORTS = ['best', 'worst', 'recent'] as const;
export type PerformanceSort = (typeof PERFORMANCE_SORTS)[number];

export const MULTI_DISMISSAL_MODES = [
  'batter_multi_out',
  'bowler_multi_wicket',
  'pair_in_match',
] as const;
export type MultiDismissalMode = (typeof MULTI_DISMISSAL_MODES)[number];

export class PlayerRankingsQueryDto {
  @ApiPropertyOptional({ enum: RANKING_METRICS, default: 'runs' })
  @IsOptional()
  @IsIn(RANKING_METRICS)
  metric?: RankingMetric = 'runs';

  @ApiPropertyOptional({ description: 'Team SportMonks id (e.g. India = 10)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @ApiPropertyOptional({ description: 'Resolve team by name (e.g. India)' })
  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;

  @ApiPropertyOptional({ example: 'T20' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ enum: RANKING_WINDOWS, default: 'career' })
  @IsOptional()
  @IsIn(RANKING_WINDOWS)
  window?: RankingWindow = 'career';

  @ApiPropertyOptional({
    description: 'Used when window=last_n_matches',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  lastN?: number = 20;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Minimum innings (batting metrics) or bowling innings',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minInnings?: number = 1;
}

export class PlayerVsBowlingQueryDto {
  @ApiPropertyOptional({ example: 'Rohit Sharma' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playerId?: string;

  @ApiPropertyOptional({ enum: VS_BOWLING_TYPES, default: 'left_arm_pace' })
  @IsOptional()
  @IsIn(VS_BOWLING_TYPES)
  vs?: VsBowlingType = 'left_arm_pace';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'Filter dismissals/balls while batting for this team' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiPropertyOptional({
    description: 'Comma list: dismissals,ballStats,recentFailInnings (default all)',
  })
  @IsOptional()
  @IsString()
  include?: string;
}

export class PlayerPerformancesQueryDto {
  @ApiPropertyOptional({ example: 'Yuzvendra Chahal' })
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  playerId?: string;

  @ApiPropertyOptional({ enum: PERFORMANCE_KINDS, default: 'batting' })
  @IsOptional()
  @IsIn(PERFORMANCE_KINDS)
  kind?: PerformanceKind = 'batting';

  @ApiPropertyOptional({ enum: PERFORMANCE_SORTS, default: 'best' })
  @IsOptional()
  @IsIn(PERFORMANCE_SORTS)
  sort?: PerformanceSort = 'best';

  @ApiPropertyOptional({ enum: VS_BOWLING_TYPES })
  @IsOptional()
  @IsIn(VS_BOWLING_TYPES)
  vsBowlingType?: VsBowlingType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class AnalyticsScopeDto {
  format?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  seasonId?: string | null;
  seasonName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  window?: string | null;
  lastN?: number | null;
  metric?: string | null;
  vs?: string | null;
}

export class RankingRowDto {
  rank!: number;
  playerId!: string;
  playerName!: string | null;
  imagePath!: string | null;
  value!: number;
  innings!: number;
  runs?: number;
  balls?: number;
  wickets?: number;
  average?: number | null;
  strikeRate?: number | null;
  economy?: number | null;
  overs?: number | null;
}

export class PlayerRankingsDto {
  scope!: AnalyticsScopeDto;
  metric!: string;
  rows!: RankingRowDto[];
  note?: string;
  struggleDefinition?: string;
}

export class VsBowlingBallStatsDto {
  available!: boolean;
  ballsFaced!: number;
  runsScored!: number;
  wickets!: number;
  fours!: number;
  sixes!: number;
  strikeRate!: number | null;
}

export class VsBowlingFailInningDto {
  fixtureId!: string;
  date!: string | null;
  matchTitle!: string | null;
  outcome!: string | null;
  batterRuns!: number | null;
  batterBalls!: number | null;
  bowlerName!: string | null;
  bowlerStyle!: string | null;
}

export class PlayerVsBowlingDto {
  scope!: AnalyticsScopeDto;
  player!: {
    playerId: string;
    name: string | null;
    imagePath: string | null;
  };
  vs!: string;
  totalDismissals!: number;
  dismissalsVsType!: number;
  dismissalSharePct!: number | null;
  byDismissalType!: Array<{ label: string; count: number; percentage: number }>;
  ballStats!: VsBowlingBallStatsDto;
  overallBallStats?: VsBowlingBallStatsDto;
  struggle!: {
    flagged: boolean;
    reasons: string[];
    definition: string;
  };
  recentFailInnings!: VsBowlingFailInningDto[];
  note?: string;
}

export class PerformanceRowDto {
  fixtureId!: string;
  date!: string | null;
  matchTitle!: string | null;
  opponent!: string | null;
  runs?: number | null;
  balls?: number | null;
  fours?: number | null;
  sixes?: number | null;
  strikeRate?: number | null;
  overs?: number | null;
  wickets?: number | null;
  runsConceded?: number | null;
  economy?: number | null;
  dismissalOutcome?: string | null;
  bowlerName?: string | null;
  bowlerStyle?: string | null;
}

export class PlayerPerformancesDto {
  scope!: AnalyticsScopeDto;
  player!: {
    playerId: string;
    name: string | null;
    imagePath: string | null;
  };
  kind!: string;
  sort!: string;
  rows!: PerformanceRowDto[];
  note?: string;
}

export class MultiDismissalsQueryDto {
  @ApiPropertyOptional({
    enum: MULTI_DISMISSAL_MODES,
    default: 'batter_multi_out',
    description:
      'batter_multi_out = same batter dismissed 2+ times in one match; bowler_multi_wicket = same bowler dismissed same batter 2+ times in one match; pair_in_match = require both batter + bowler',
  })
  @IsOptional()
  @IsIn(MULTI_DISMISSAL_MODES)
  mode?: MultiDismissalMode = 'batter_multi_out';

  @ApiPropertyOptional({ example: 'Virat Kohli' })
  @IsOptional()
  @IsString()
  batter?: string;

  @IsOptional()
  @IsString()
  batterId?: string;

  @ApiPropertyOptional({ example: 'Jasprit Bumrah' })
  @IsOptional()
  @IsString()
  bowler?: string;

  @IsOptional()
  @IsString()
  bowlerId?: string;

  @ApiPropertyOptional({
    description:
      'When mode=batter_multi_out, only keep cases where the same credited bowler appears on 2+ dismissals',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  sameBowler?: boolean;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  minDismissals?: number = 2;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class MultiDismissalEventDto {
  scoreboard!: string | null;
  outcome!: string | null;
  runs!: number | null;
  balls!: number | null;
  bowlerId!: string | null;
  bowlerName!: string | null;
}

export class MultiDismissalRowDto {
  fixtureId!: string;
  date!: string | null;
  matchTitle!: string | null;
  batterId!: string;
  batterName!: string | null;
  batterImagePath!: string | null;
  /** Set when grouping by bowler (bowler_multi_wicket / pair / sameBowler). */
  bowlerId!: string | null;
  bowlerName!: string | null;
  dismissalCount!: number;
  dismissals!: MultiDismissalEventDto[];
}

export class MultiDismissalsDto {
  scope!: AnalyticsScopeDto;
  mode!: string;
  minDismissals!: number;
  sameBowler!: boolean;
  batter?: {
    playerId: string;
    name: string | null;
    imagePath: string | null;
  } | null;
  bowler?: {
    playerId: string;
    name: string | null;
    imagePath: string | null;
  } | null;
  rows!: MultiDismissalRowDto[];
  note?: string;
}
