import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TeamSearchQueryDto {
  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsString()
  q!: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class TeamDto {
  sportmonksId!: string;
  name!: string;
  code!: string | null;
  countryId!: string | null;
  imagePath!: string | null;
  nationalTeam!: boolean | null;
}

export class SquadQueryDto {
  @ApiPropertyOptional({ description: 'Season sportmonks id — IPL 2026 = 1795' })
  @Type(() => Number)
  @IsInt()
  seasonId!: number;
}

export class TeamSeasonStatsQueryDto {
  @ApiPropertyOptional({ description: 'Season sportmonks id' })
  @Type(() => Number)
  @IsInt()
  seasonId!: number;

  @ApiPropertyOptional({ description: 'League sportmonks id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;
}

export class TeamHeadToHeadQueryDto {
  @ApiPropertyOptional({ description: 'First team SportMonks id' })
  @Type(() => Number)
  @IsInt()
  teamAId!: number;

  @ApiPropertyOptional({ description: 'Second team SportMonks id' })
  @Type(() => Number)
  @IsInt()
  teamBId!: number;

  @ApiPropertyOptional({ description: 'Optional league SportMonks id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leagueId?: number;
}

export class SquadMemberDto {
  playerId!: string;
  playerName!: string | null;
  battingstyle!: string | null;
  bowlingstyle!: string | null;
}

export class TeamSquadDto {
  teamId!: string;
  teamName!: string | null;
  seasonId!: string;
  members!: SquadMemberDto[];
}

export class TeamSeasonStatsDto {
  teamId!: string;
  teamName!: string | null;
  leagueId!: string | null;
  seasonId!: string;
  matches!: number;
  wins!: number;
  losses!: number;
  noResults!: number;
  runsFor!: number;
  wicketsLost!: number;
  runsAgainst!: number;
  wicketsTaken!: number;
}

export class TeamHeadToHeadMatchDto {
  fixtureId!: string;
  date!: string | null;
  leagueId!: string | null;
  seasonId!: string | null;
  localTeamId!: string | null;
  visitorTeamId!: string | null;
  localTeamName!: string | null;
  visitorTeamName!: string | null;
  winnerTeamId!: string | null;
}

export class TeamHeadToHeadDto {
  teamAId!: string;
  teamAName!: string | null;
  teamBId!: string;
  teamBName!: string | null;
  played!: number;
  teamAWins!: number;
  teamBWins!: number;
  noResults!: number;
  matches!: TeamHeadToHeadMatchDto[];
}
