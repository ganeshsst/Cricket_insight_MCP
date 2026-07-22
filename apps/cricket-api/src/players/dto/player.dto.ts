import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class PlayerStatsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by match format e.g. T20 (IPL), T20I, ODI, Test' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'League sportmonks id — IPL = 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @ApiPropertyOptional({ description: 'Season sportmonks id — IPL 2026 = 1795' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;
}

export class StatsScopeDto {
  format?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
  seasonId?: string | null;
  seasonName?: string | null;
}

export class PlayerSearchQueryDto {
  @ApiPropertyOptional({ example: 'Kohli' })
  @IsString()
  q!: string;

  @ApiPropertyOptional({ description: 'Only include players associated with this league' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}

export class PlayerByNameQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ example: 'Jasprit Bumrah' })
  @IsString()
  q!: string;
}

export class PlayerCompareByNameQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ example: 'Virat Kohli' })
  @IsString()
  a!: string;

  @ApiPropertyOptional({ example: 'MS Dhoni' })
  @IsString()
  b!: string;
}

/** Batter vs bowler head-to-head. Prefer batter+bowler; or pass a+b to auto-assign roles. */
export class PlayerMatchupByNameQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ example: 'Virat Kohli', description: 'Batter name' })
  @IsOptional()
  @IsString()
  batter?: string;

  @ApiPropertyOptional({ example: 'Jasprit Bumrah', description: 'Bowler name' })
  @IsOptional()
  @IsString()
  bowler?: string;

  @ApiPropertyOptional({
    example: 'Virat Kohli',
    description: 'Player A when batter/bowler roles are not specified',
  })
  @IsOptional()
  @IsString()
  a?: string;

  @ApiPropertyOptional({
    example: 'Jasprit Bumrah',
    description: 'Player B when batter/bowler roles are not specified',
  })
  @IsOptional()
  @IsString()
  b?: string;
}

export class PlayerMatchupQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ example: '46' })
  @IsString()
  batterId!: string;

  @ApiPropertyOptional({ example: '55' })
  @IsString()
  bowlerId!: string;
}

export class PlayerSearchResultDto {
  sportmonksId!: string;
  fullname!: string;
  firstname!: string | null;
  lastname!: string | null;
  countryId!: string | null;
  battingstyle!: string | null;
  bowlingstyle!: string | null;
  imagePath!: string | null;
  dateofbirth!: string | null;
  positionId!: string | null;
}

export class PlayerProfileDto extends PlayerSearchResultDto {
  gender!: string | null;
}

export class PlayerBattingStatsDto {
  playerId!: string;
  scope!: StatsScopeDto;
  innings!: number;
  runs!: number;
  balls!: number;
  fours!: number;
  sixes!: number;
  strikeRate!: number | null;
  average!: number | null;
  note?: string;
}

export class PlayerBowlingStatsDto {
  playerId!: string;
  scope!: StatsScopeDto;
  innings!: number;
  overs!: number;
  maidens!: number;
  runsConceded!: number;
  wickets!: number;
  economy!: number | null;
  average!: number | null;
  note?: string;
}

export class PlayerCareerQueryDto {
  @ApiPropertyOptional({ description: 'Filter by match format e.g. T20' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ description: 'League sportmonks id — IPL = 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;
}

export class PlayerMatchesQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}

export class PlayerDismissalByNameQueryDto extends PlayerStatsQueryDto {
  @ApiPropertyOptional({ example: 'Virat Kohli' })
  @IsString()
  q!: string;
}

export class DismissalBreakdownRowDto {
  label!: string;
  count!: number;
  percentage!: number;
}

export class PlayerDismissalAnalysisDto {
  playerId!: string;
  playerName!: string | null;
  imagePath!: string | null;
  scope!: StatsScopeDto;
  /** Dismissals attributed to how the batter got out (excludes not-outs). */
  totalDismissals!: number;
  notOuts!: number;
  byDismissalType!: DismissalBreakdownRowDto[];
  byBowlerType!: DismissalBreakdownRowDto[];
  byBowlingStyle!: DismissalBreakdownRowDto[];
  byPhase!: DismissalBreakdownRowDto[];
  note?: string;
}

export class PlayerCareerSeasonDto {
  seasonId!: string;
  seasonName!: string | null;
  leagueId!: string | null;
  leagueName!: string | null;
  format!: string | null;
  batting!: {
    innings: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number | null;
    average: number | null;
  };
  bowling!: {
    innings: number;
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    economy: number | null;
    average: number | null;
  };
}

export class PlayerCareerDto {
  playerId!: string;
  scope!: StatsScopeDto;
  seasons!: PlayerCareerSeasonDto[];
  note?: string;
}

export class PlayerCompareQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated SportMonks player ids (2–4)',
    example: '46,3362',
  })
  @IsString()
  ids!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  format?: string;

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
}

export class PlayerCompareEntryDto {
  profile!: PlayerProfileDto;
  batting!: PlayerBattingStatsDto;
  bowling!: PlayerBowlingStatsDto;
}

export class PlayerCompareDto {
  scope!: StatsScopeDto;
  players!: PlayerCompareEntryDto[];
}

export class PlayerMatchupPartyDto {
  playerId!: string;
  name!: string | null;
  imagePath!: string | null;
  role!: 'batter' | 'bowler';
}

export class PlayerMatchupDismissalRowDto {
  fixtureId!: string;
  date!: string | null;
  matchTitle!: string | null;
  outcome!: string | null;
  batterRuns!: number | null;
  batterBalls!: number | null;
}

export class PlayerMatchupBallStatsDto {
  ballsFaced!: number;
  runsScored!: number;
  wickets!: number;
  fours!: number;
  sixes!: number;
  strikeRate!: number | null;
  available!: boolean;
}

export class PlayerMatchupDto {
  scope!: StatsScopeDto;
  batter!: PlayerMatchupPartyDto;
  bowler!: PlayerMatchupPartyDto;
  /** Times this bowler dismissed this batter in loaded scorecards. */
  dismissals!: number;
  byDismissalType!: DismissalBreakdownRowDto[];
  recentDismissals!: PlayerMatchupDismissalRowDto[];
  /** Ball-level H2H when fixture_balls coverage exists for the pair. */
  ballStats!: PlayerMatchupBallStatsDto;
  roleAssignment!: 'explicit' | 'inferred';
  note?: string;
}

export class PlayerStatsBundleDto {
  profile!: PlayerProfileDto;
  batting!: PlayerBattingStatsDto;
  bowling!: PlayerBowlingStatsDto;
}

export class PlayerMatchLogRowDto {
  fixtureId!: string;
  date!: string | null;
  leagueId!: string | null;
  seasonId!: string | null;
  localTeamName!: string | null;
  visitorTeamName!: string | null;
  runs!: number | null;
  balls!: number | null;
  fours!: number | null;
  sixes!: number | null;
  battingStrikeRate!: number | null;
  overs!: number | null;
  runsConceded!: number | null;
  wickets!: number | null;
  economy!: number | null;
}

export class PlayerMatchLogDto {
  playerId!: string;
  matches!: PlayerMatchLogRowDto[];
  note?: string;
}
