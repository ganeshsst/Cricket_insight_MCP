import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  SquadMemberDto,
  TeamDto,
  TeamSquadDto,
} from './dto/team.dto.js';

type TeamRow = {
  sportmonks_id: string;
  name: string;
  code: string | null;
  country_id: string | null;
  image_path: string | null;
  national_team: boolean | null;
};

@Injectable()
export class TeamsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async search(q: string, limit: number): Promise<TeamDto[]> {
    const { rows } = await this.db.query<TeamRow>(
      `SELECT sportmonks_id::text, name, code,
              country_id::text, image_path, national_team
       FROM master.teams
       WHERE is_active IS DISTINCT FROM false
         AND (name ILIKE $1 OR code ILIKE $1)
       ORDER BY name
       LIMIT $2`,
      [`%${q}%`, limit],
    );

    return rows.map((row) => this.toDto(row));
  }

  async getById(teamId: string): Promise<TeamDto> {
    const { rows } = await this.db.query<TeamRow>(
      `SELECT sportmonks_id::text, name, code,
              country_id::text, image_path, national_team
       FROM master.teams
       WHERE sportmonks_id = $1::bigint`,
      [teamId],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    return this.toDto(row);
  }

  async getSquad(teamId: string, seasonId: number): Promise<TeamSquadDto> {
    const team = await this.getById(teamId);

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      battingstyle: string | null;
      bowlingstyle: string | null;
    }>(
      `SELECT tsm.player_id::text,
              p.fullname AS player_name,
              p.battingstyle,
              p.bowlingstyle
       FROM master.team_squad_members tsm
       LEFT JOIN master.players p ON p.sportmonks_id = tsm.player_id
       WHERE tsm.team_id = $1::bigint AND tsm.season_id = $2::bigint
       ORDER BY p.fullname NULLS LAST`,
      [teamId, seasonId],
    );

    const members: SquadMemberDto[] = rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      battingstyle: row.battingstyle,
      bowlingstyle: row.bowlingstyle,
    }));

    return {
      teamId,
      teamName: team.name,
      seasonId: String(seasonId),
      members,
    };
  }

  private toDto(row: TeamRow): TeamDto {
    return {
      sportmonksId: row.sportmonks_id,
      name: row.name,
      code: row.code,
      countryId: row.country_id,
      imagePath: row.image_path,
      nationalTeam: row.national_team,
    };
  }
}
