import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  isLive!: boolean;
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
  teamId!: string;
  sortOrder!: number | null;
  runs!: number | null;
  balls!: number | null;
  fours!: number | null;
  sixes!: number | null;
  strikeRate!: number | null;
  wicketOutcome!: string | null;
  bowlerId!: string | null;
  fowScore!: number | null;
  fowBalls!: string | null;
}

export class ScorecardBowlingRowDto {
  playerId!: string;
  playerName!: string | null;
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
  inningsTotalRows!: number;
  battingRows!: number;
  bowlingRows!: number;
  lineupRows!: number;
  note?: string;
}
