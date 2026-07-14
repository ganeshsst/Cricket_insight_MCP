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

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}

export class PlayerSearchResultDto {
  sportmonksId!: string;
  fullname!: string;
  firstname!: string | null;
  lastname!: string | null;
  countryId!: string | null;
  battingstyle!: string | null;
  bowlingstyle!: string | null;
}

export class PlayerProfileDto extends PlayerSearchResultDto {
  dateofbirth!: string | null;
  gender!: string | null;
  imagePath!: string | null;
  positionId!: string | null;
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
