import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  SquadMemberDto,
  TeamDto,
  TeamHeadToHeadDto,
  TeamHeadToHeadQueryDto,
  TeamSeasonStatsDto,
  TeamSeasonStatsQueryDto,
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

    return rows.map((row: TeamRow) => this.toDto(row));
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
      image_path: string | null;
      battingstyle: string | null;
      bowlingstyle: string | null;
    }>(
      `SELECT tsm.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              p.battingstyle,
              p.bowlingstyle
       FROM master.team_squad_members tsm
       LEFT JOIN master.players p ON p.sportmonks_id = tsm.player_id
       WHERE tsm.team_id = $1::bigint AND tsm.season_id = $2::bigint
       ORDER BY p.fullname NULLS LAST`,
      [teamId, seasonId],
    );

    const members: SquadMemberDto[] = rows.map((row: (typeof rows)[number]) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      imagePath: row.image_path,
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

  async getSeasonStats(
    teamId: string,
    query: TeamSeasonStatsQueryDto,
  ): Promise<TeamSeasonStatsDto> {
    const team = await this.getById(teamId);
    const params: unknown[] = [teamId, query.seasonId];
    const conditions = [
      'ff.season_id = $2::bigint',
      '(ff.localteam_id = $1::bigint OR ff.visitorteam_id = $1::bigint)',
    ];
    if (query.leagueId) {
      params.push(query.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }

    const { rows } = await this.db.query<{
      league_id: string | null;
      matches: string;
      wins: string;
      losses: string;
      no_results: string;
      runs_for: string;
      wickets_lost: string;
      runs_against: string;
      wickets_taken: string;
    }>(
      `SELECT MIN(ff.league_id)::text AS league_id,
              COUNT(*)::text AS matches,
              COUNT(*) FILTER (WHERE ff.winner_team_id = $1::bigint)::text AS wins,
              COUNT(*) FILTER (
                WHERE ff.winner_team_id IS NOT NULL
                  AND ff.winner_team_id <> $1::bigint
              )::text AS losses,
              COUNT(*) FILTER (WHERE ff.winner_team_id IS NULL)::text AS no_results,
              COALESCE(SUM(fr_for.score), 0)::text AS runs_for,
              COALESCE(SUM(fr_for.wickets), 0)::text AS wickets_lost,
              COALESCE(SUM(fr_against.score), 0)::text AS runs_against,
              COALESCE(SUM(fr_against.wickets), 0)::text AS wickets_taken
       FROM gold.fact_fixture ff
       LEFT JOIN matches.fixture_runs fr_for
         ON fr_for.fixture_id = ff.fixture_id AND fr_for.team_id = $1::bigint
       LEFT JOIN matches.fixture_runs fr_against
         ON fr_against.fixture_id = ff.fixture_id AND fr_against.team_id <> $1::bigint
       WHERE ${conditions.join(' AND ')}`,
      params,
    );

    const row = rows[0];
    return {
      teamId,
      teamName: team.name,
      leagueId: row?.league_id ?? (query.leagueId ? String(query.leagueId) : null),
      seasonId: String(query.seasonId),
      matches: Number(row?.matches ?? 0),
      wins: Number(row?.wins ?? 0),
      losses: Number(row?.losses ?? 0),
      noResults: Number(row?.no_results ?? 0),
      runsFor: Number(row?.runs_for ?? 0),
      wicketsLost: Number(row?.wickets_lost ?? 0),
      runsAgainst: Number(row?.runs_against ?? 0),
      wicketsTaken: Number(row?.wickets_taken ?? 0),
    };
  }

  async getHeadToHead(query: TeamHeadToHeadQueryDto): Promise<TeamHeadToHeadDto> {
    const [teamA, teamB] = await Promise.all([
      this.getById(String(query.teamAId)),
      this.getById(String(query.teamBId)),
    ]);
    const params: unknown[] = [query.teamAId, query.teamBId];
    const conditions = [
      `((ff.localteam_id = $1::bigint AND ff.visitorteam_id = $2::bigint)
        OR (ff.localteam_id = $2::bigint AND ff.visitorteam_id = $1::bigint))`,
    ];
    if (query.leagueId) {
      params.push(query.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }

    const { rows } = await this.db.query<{
      fixture_id: string;
      date_key: string | null;
      league_id: string | null;
      season_id: string | null;
      localteam_id: string | null;
      visitorteam_id: string | null;
      winner_team_id: string | null;
      local_team_name: string | null;
      visitor_team_name: string | null;
    }>(
      `SELECT ff.fixture_id::text,
              ff.date_key::text,
              ff.league_id::text,
              ff.season_id::text,
              ff.localteam_id::text,
              ff.visitorteam_id::text,
              ff.winner_team_id::text,
              lt.name AS local_team_name,
              vt.name AS visitor_team_name
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC`,
      params,
    );

    return {
      teamAId: String(query.teamAId),
      teamAName: teamA.name,
      teamBId: String(query.teamBId),
      teamBName: teamB.name,
      played: rows.length,
      teamAWins: rows.filter((row: (typeof rows)[number]) => row.winner_team_id === String(query.teamAId)).length,
      teamBWins: rows.filter((row: (typeof rows)[number]) => row.winner_team_id === String(query.teamBId)).length,
      noResults: rows.filter((row: (typeof rows)[number]) => row.winner_team_id == null).length,
      matches: rows.map((row: (typeof rows)[number]) => ({
        fixtureId: row.fixture_id,
        date: row.date_key,
        leagueId: row.league_id,
        seasonId: row.season_id,
        localTeamId: row.localteam_id,
        visitorTeamId: row.visitorteam_id,
        localTeamName: row.local_team_name,
        visitorTeamName: row.visitor_team_name,
        winnerTeamId: row.winner_team_id,
      })),
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
