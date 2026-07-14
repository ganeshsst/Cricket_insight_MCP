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
