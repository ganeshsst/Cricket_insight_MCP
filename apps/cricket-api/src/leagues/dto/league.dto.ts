import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LeagueSearchQueryDto {
  @ApiPropertyOptional({ example: 'IPL' })
  @IsString()
  q!: string;
}

export class LeagueDto {
  sportmonksId!: string;
  name!: string;
  code!: string | null;
}

export class SeasonDto {
  sportmonksId!: string;
  name!: string;
  leagueId!: string;
  leagueName!: string;
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ example: 'T20', description: 'Match format — IPL uses T20' })
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

export class StandingRowDto {
  position!: number;
  teamId!: string;
  teamName!: string | null;
  points!: number;
  played!: number;
  won!: number;
  lost!: number;
  draw!: number;
  noResult!: number;
  netRunRate!: number | null;
  recentForm!: string[] | null;
}

export class SeasonStandingsDto {
  leagueId!: string;
  seasonId!: string;
  leagueName!: string | null;
  seasonName!: string | null;
  standings!: StandingRowDto[];
  note?: string;
}

export class BattingLeaderboardRowDto {
  playerId!: string;
  playerName!: string | null;
  innings!: number;
  runs!: number;
  balls!: number;
  fours!: number;
  sixes!: number;
  strikeRate!: number | null;
  average!: number | null;
}

export class BowlingLeaderboardRowDto {
  playerId!: string;
  playerName!: string | null;
  innings!: number;
  overs!: number;
  maidens!: number;
  runsConceded!: number;
  wickets!: number;
  economy!: number | null;
  average!: number | null;
}

export class SeasonLeaderboardDto {
  leagueId!: string;
  seasonId!: string;
  leagueName!: string | null;
  seasonName!: string | null;
  format!: string | null;
  batting?: BattingLeaderboardRowDto[];
  bowling?: BowlingLeaderboardRowDto[];
  note?: string;
}

export class SeasonCoverageDto {
  leagueId!: string;
  seasonId!: string;
  leagueName!: string | null;
  seasonName!: string | null;
  totalFixtures!: number;
  fixturesWithBatting!: number;
  fixturesWithBowling!: number;
  standingsTeams!: number;
  note?: string;
}
