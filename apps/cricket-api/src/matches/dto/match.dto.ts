import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MatchListQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @ApiPropertyOptional({ example: 'T20I' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({
    description: 'Match status filter e.g. Finished, NS, Live',
    example: 'Finished',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class MatchSearchQueryDto extends MatchListQueryDto {
  @ApiPropertyOptional({ description: 'Semantic match type, e.g. final' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'First team SportMonks id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamAId?: number;

  @ApiPropertyOptional({ description: 'Second team SportMonks id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamBId?: number;
}

export class MatchBallsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by scoreboard code e.g. S1' })
  @IsOptional()
  @IsString()
  scoreboard?: string;

  @ApiPropertyOptional({ default: 120, description: 'Max balls to return (1–600)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  limit?: number = 120;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class MatchSummaryDto {
  fixtureId!: string;
  date!: string | null;
  format!: string | null;
  status!: string | null;
  leagueId!: string | null;
  seasonId!: string | null;
  localTeamId!: string | null;
  visitorTeamId!: string | null;
  localTeamName!: string | null;
  visitorTeamName!: string | null;
  winnerTeamId!: string | null;
  venueId!: string | null;
  /** Derived from status === Live (gold.is_live is unreliable). */
  isLive!: boolean;
  /** Present when /matches/final returns a date-heuristic result. */
  inferredFinal?: boolean;
}

export class MatchInningScoreDto {
  teamId!: string;
  teamName!: string | null;
  inning!: number;
  score!: number | null;
  wickets!: number | null;
  overs!: number | null;
}

export class MatchDetailDto extends MatchSummaryDto {
  tossWonTeamId!: string | null;
  manOfMatchId!: string | null;
  elected!: string | null;
  note!: string | null;
  innings!: MatchInningScoreDto[];
}

export class ScorecardBattingRowDto {
  playerId!: string;
  playerName!: string | null;
  imagePath!: string | null;
  teamId!: string;
  sortOrder!: number | null;
  runs!: number | null;
  balls!: number | null;
  fours!: number | null;
  sixes!: number | null;
  strikeRate!: number | null;
  wicketOutcome!: string | null;
  bowlerId!: string | null;
  bowlerName!: string | null;
  catchStumpPlayerId!: string | null;
  catchStumpPlayerName!: string | null;
  runoutByPlayerId!: string | null;
  runoutByPlayerName!: string | null;
  fowScore!: number | null;
  fowBalls!: string | null;
}

export class ScorecardBowlingRowDto {
  playerId!: string;
  playerName!: string | null;
  imagePath!: string | null;
  teamId!: string;
  sortOrder!: number | null;
  overs!: number | null;
  maidens!: number | null;
  runsConceded!: number | null;
  wickets!: number | null;
  economy!: number | null;
}

export class ScorecardInningDto {
  scoreboard!: string | null;
  teamId!: string;
  teamName!: string | null;
  batting!: ScorecardBattingRowDto[];
  bowling!: ScorecardBowlingRowDto[];
}

export class ScorecardLineupPlayerDto {
  playerId!: string;
  playerName!: string | null;
  imagePath!: string | null;
  isCaptain!: boolean;
  isWicketkeeper!: boolean;
  isSubstitute!: boolean;
}

export class ScorecardLineupDto {
  teamId!: string;
  teamName!: string | null;
  players!: ScorecardLineupPlayerDto[];
}

export class MatchScorecardDto {
  fixture!: MatchDetailDto;
  innings!: ScorecardInningDto[];
  lineups!: ScorecardLineupDto[];
}

export class MatchCoverageDto {
  fixtureId!: string;
  hasInningsTotals!: boolean;
  hasBatting!: boolean;
  hasBowling!: boolean;
  hasLineups!: boolean;
  hasBalls!: boolean;
  hasOvers!: boolean;
  inningsTotalRows!: number;
  battingRows!: number;
  bowlingRows!: number;
  lineupRows!: number;
  ballRows!: number;
  overRows!: number;
  note?: string;
}

export class MatchOverDto {
  scoreboard!: string | null;
  teamId!: string;
  teamName!: string | null;
  overNumber!: number;
  runsInOver!: number;
  wicketsInOver!: number;
  bowlerId!: string | null;
  bowlerName!: string | null;
}

export class MatchOversDto {
  fixtureId!: string;
  overs!: MatchOverDto[];
}

export class MatchPartnershipDto {
  scoreboard!: string | null;
  teamId!: string | null;
  teamName!: string | null;
  wicketNumber!: number;
  player1Id!: string;
  player1Name!: string | null;
  player2Id!: string;
  player2Name!: string | null;
  runs!: number;
  balls!: number;
  startBall!: string | null;
  endBall!: string | null;
}

export class MatchPartnershipsDto {
  fixtureId!: string;
  partnerships!: MatchPartnershipDto[];
  note?: string;
}

export class MatchBallDto {
  scoreboard!: string | null;
  teamId!: string | null;
  teamName!: string | null;
  ballNumber!: string;
  batsmanStrikerId!: string | null;
  batsmanStrikerName!: string | null;
  batsmanNonStrikerId!: string | null;
  batsmanNonStrikerName!: string | null;
  bowlerId!: string | null;
  bowlerName!: string | null;
  runsOnBall!: number | null;
  isWicket!: boolean;
  isFour!: boolean;
  isSix!: boolean;
  outcome!: string | null;
  batsmanOutId!: string | null;
}

export class MatchBallsDto {
  fixtureId!: string;
  balls!: MatchBallDto[];
  totalAvailable!: number;
  limit!: number;
  offset!: number;
  note?: string;
}

export class MatchOfficialsQueryDto {
  @ApiPropertyOptional({ description: 'Fixture SportMonks id — single-match officials' })
  @IsOptional()
  @IsString()
  fixtureId?: string;

  @ApiPropertyOptional({ example: 1, description: 'League SportMonks id (requires seasonId)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;

  @ApiPropertyOptional({ example: 1795, description: 'Season SportMonks id (requires leagueId)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seasonId?: number;

  @ApiPropertyOptional({ description: 'Filter to one official SportMonks id' })
  @IsOptional()
  @IsString()
  officialId?: string;

  @ApiPropertyOptional({ description: 'Filter by official name fragment' })
  @IsOptional()
  @IsString()
  officialName?: string;

  @ApiPropertyOptional({
    enum: ['umpire', 'tv_umpire', 'referee'],
    description: 'umpire = on-field umpires (first + second)',
  })
  @IsOptional()
  @IsIn(['umpire', 'tv_umpire', 'referee'])
  role?: 'umpire' | 'tv_umpire' | 'referee';

  @ApiPropertyOptional({
    enum: ['fixture', 'official'],
    description: 'fixture = per-match rows; official = leaderboard by matches officiated',
  })
  @IsOptional()
  @IsIn(['fixture', 'official'])
  groupBy?: 'fixture' | 'official';

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class MatchOfficialRowDto {
  fixtureId!: string | null;
  date!: string | null;
  matchTitle!: string | null;
  localTeamName!: string | null;
  visitorTeamName!: string | null;
  officialId!: string;
  officialName!: string | null;
  role!: string;
  roleLabel!: string;
  matchesOfficiated!: number | null;
}

export class MatchOfficialsDto {
  mode!: 'fixture' | 'season';
  groupBy!: 'fixture' | 'official';
  fixtureId!: string | null;
  leagueId!: string | null;
  seasonId!: string | null;
  rows!: MatchOfficialRowDto[];
  meta!: {
    total: number;
    limit: number;
    offset: number;
    coverageNote?: string;
  };
}
