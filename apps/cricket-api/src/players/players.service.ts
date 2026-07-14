import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { LeaguesService } from '../leagues/leagues.service.js';
import type {
  PlayerBattingStatsDto,
  PlayerBowlingStatsDto,
  PlayerCareerDto,
  PlayerCareerQueryDto,
  PlayerCareerSeasonDto,
  PlayerCompareDto,
  PlayerCompareQueryDto,
  PlayerProfileDto,
  PlayerSearchResultDto,
  PlayerStatsQueryDto,
} from './dto/player.dto.js';

type PlayerRow = {
  sportmonks_id: string;
  fullname: string;
  firstname: string | null;
  lastname: string | null;
  country_id: string | null;
  position_id: string | null;
  dateofbirth: string | null;
  gender: string | null;
  battingstyle: string | null;
  bowlingstyle: string | null;
  image_path: string | null;
};

@Injectable()
export class PlayersService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
  ) {}

  async search(q: string, limit: number): Promise<PlayerSearchResultDto[]> {
    const { rows } = await this.db.query<PlayerRow>(
      `SELECT sportmonks_id::text, fullname, firstname, lastname,
              country_id::text, battingstyle, bowlingstyle
       FROM master.players
       WHERE is_active IS DISTINCT FROM false
         AND fullname ILIKE $1
       ORDER BY fullname
       LIMIT $2`,
      [`%${q}%`, limit],
    );

    return rows.map((row) => ({
      sportmonksId: row.sportmonks_id,
      fullname: row.fullname,
      firstname: row.firstname,
      lastname: row.lastname,
      countryId: row.country_id,
      battingstyle: row.battingstyle,
      bowlingstyle: row.bowlingstyle,
    }));
  }

  async getById(sportmonksId: string): Promise<PlayerProfileDto> {
    const { rows } = await this.db.query<PlayerRow>(
      `SELECT sportmonks_id::text, fullname, firstname, lastname,
              country_id::text, position_id::text, dateofbirth::text,
              gender, battingstyle, bowlingstyle, image_path
       FROM master.players
       WHERE sportmonks_id = $1::bigint`,
      [sportmonksId],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Player ${sportmonksId} not found`);
    }

    return {
      sportmonksId: row.sportmonks_id,
      fullname: row.fullname,
      firstname: row.firstname,
      lastname: row.lastname,
      countryId: row.country_id,
      positionId: row.position_id,
      dateofbirth: row.dateofbirth,
      gender: row.gender,
      battingstyle: row.battingstyle,
      bowlingstyle: row.bowlingstyle,
      imagePath: row.image_path,
    };
  }

  async getBattingStats(
    sportmonksId: string,
    filters: PlayerStatsQueryDto,
  ): Promise<PlayerBattingStatsDto> {
    await this.getById(sportmonksId);

    const params: unknown[] = [sportmonksId];
    let joinFixture = '';
    const conditions = ['fb.player_id = $1::bigint'];

    if (filters.format || filters.leagueId || filters.seasonId) {
      joinFixture = 'JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id';
      if (filters.format) {
        params.push(filters.format);
        conditions.push(`ff.match_format = $${params.length}`);
      }
      if (filters.leagueId) {
        params.push(filters.leagueId);
        conditions.push(`ff.league_id = $${params.length}::bigint`);
      }
      if (filters.seasonId) {
        params.push(filters.seasonId);
        conditions.push(`ff.season_id = $${params.length}::bigint`);
      }
    }

    const { rows } = await this.db.query<{
      player_id: string;
      innings: string;
      runs: string;
      balls: string;
      fours: string;
      sixes: string;
      strike_rate: string | null;
      average: string | null;
    }>(
      `SELECT fb.player_id::text,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.runs_scored), 0)::text AS runs,
              COALESCE(SUM(fb.balls_faced), 0)::text AS balls,
              COALESCE(SUM(fb.fours), 0)::text AS fours,
              COALESCE(SUM(fb.sixes), 0)::text AS sixes,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(SUM(fb.balls_faced), 0) * 100, 2)::text AS strike_rate,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(COUNT(DISTINCT fb.fixture_id), 0), 2)::text AS average
       FROM gold.fact_batting fb
       ${joinFixture}
       WHERE ${conditions.join(' AND ')}
       GROUP BY fb.player_id`,
      params,
    );

    const row = rows[0];
    const scope = await this.leagues.resolveScope(filters);
    const innings = Number(row?.innings ?? 0);
    const note = await this.leagues.buildStatsNote(filters, scope, innings);

    return {
      playerId: sportmonksId,
      scope,
      innings,
      runs: Number(row?.runs ?? 0),
      balls: Number(row?.balls ?? 0),
      fours: Number(row?.fours ?? 0),
      sixes: Number(row?.sixes ?? 0),
      strikeRate: row?.strike_rate ? Number(row.strike_rate) : null,
      average: row?.average ? Number(row.average) : null,
      note,
    };
  }

  async getBowlingStats(
    sportmonksId: string,
    filters: PlayerStatsQueryDto,
  ): Promise<PlayerBowlingStatsDto> {
    await this.getById(sportmonksId);

    const params: unknown[] = [sportmonksId];
    let joinFixture = '';
    const conditions = ['fb.player_id = $1::bigint'];

    if (filters.format || filters.leagueId || filters.seasonId) {
      joinFixture = 'JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id';
      if (filters.format) {
        params.push(filters.format);
        conditions.push(`ff.match_format = $${params.length}`);
      }
      if (filters.leagueId) {
        params.push(filters.leagueId);
        conditions.push(`ff.league_id = $${params.length}::bigint`);
      }
      if (filters.seasonId) {
        params.push(filters.seasonId);
        conditions.push(`ff.season_id = $${params.length}::bigint`);
      }
    }

    const { rows } = await this.db.query<{
      player_id: string;
      innings: string;
      overs: string;
      maidens: string;
      runs_conceded: string;
      wickets: string;
      economy: string | null;
      average: string | null;
    }>(
      `SELECT fb.player_id::text,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.overs), 0)::text AS overs,
              COALESCE(SUM(fb.maidens), 0)::text AS maidens,
              COALESCE(SUM(fb.runs_conceded), 0)::text AS runs_conceded,
              COALESCE(SUM(fb.wickets), 0)::text AS wickets,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.overs), 0), 2)::text AS economy,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.wickets), 0), 2)::text AS average
       FROM gold.fact_bowling fb
       ${joinFixture}
       WHERE ${conditions.join(' AND ')}
       GROUP BY fb.player_id`,
      params,
    );

    const row = rows[0];
    const scope = await this.leagues.resolveScope(filters);
    const innings = Number(row?.innings ?? 0);
    const note = await this.leagues.buildStatsNote(filters, scope, innings);

    return {
      playerId: sportmonksId,
      scope,
      innings,
      overs: Number(row?.overs ?? 0),
      maidens: Number(row?.maidens ?? 0),
      runsConceded: Number(row?.runs_conceded ?? 0),
      wickets: Number(row?.wickets ?? 0),
      economy: row?.economy ? Number(row.economy) : null,
      average: row?.average ? Number(row.average) : null,
      note,
    };
  }

  async getCareer(
    sportmonksId: string,
    filters: PlayerCareerQueryDto,
  ): Promise<PlayerCareerDto> {
    await this.getById(sportmonksId);

    const params: unknown[] = [sportmonksId];
    const conditions = ['fb.player_id = $1::bigint'];
    if (filters.format) {
      params.push(filters.format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    if (filters.leagueId) {
      params.push(filters.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }

    const batting = await this.db.query<{
      season_id: string;
      season_name: string | null;
      league_id: string | null;
      league_name: string | null;
      match_format: string | null;
      innings: string;
      runs: string;
      balls: string;
      fours: string;
      sixes: string;
      strike_rate: string | null;
      average: string | null;
    }>(
      `SELECT ff.season_id::text,
              s.name AS season_name,
              ff.league_id::text,
              l.name AS league_name,
              ff.match_format,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.runs_scored), 0)::text AS runs,
              COALESCE(SUM(fb.balls_faced), 0)::text AS balls,
              COALESCE(SUM(fb.fours), 0)::text AS fours,
              COALESCE(SUM(fb.sixes), 0)::text AS sixes,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(SUM(fb.balls_faced), 0) * 100, 2)::text AS strike_rate,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(COUNT(DISTINCT fb.fixture_id), 0), 2)::text AS average
       FROM gold.fact_batting fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN master.seasons s ON s.sportmonks_id = ff.season_id
       LEFT JOIN master.leagues l ON l.sportmonks_id = ff.league_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ff.season_id, s.name, ff.league_id, l.name, ff.match_format
       ORDER BY s.name DESC NULLS LAST, ff.season_id DESC`,
      params,
    );

    const bowling = await this.db.query<{
      season_id: string;
      season_name: string | null;
      league_id: string | null;
      league_name: string | null;
      match_format: string | null;
      innings: string;
      overs: string;
      maidens: string;
      runs_conceded: string;
      wickets: string;
      economy: string | null;
      average: string | null;
    }>(
      `SELECT ff.season_id::text,
              s.name AS season_name,
              ff.league_id::text,
              l.name AS league_name,
              ff.match_format,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.overs), 0)::text AS overs,
              COALESCE(SUM(fb.maidens), 0)::text AS maidens,
              COALESCE(SUM(fb.runs_conceded), 0)::text AS runs_conceded,
              COALESCE(SUM(fb.wickets), 0)::text AS wickets,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.overs), 0), 2)::text AS economy,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.wickets), 0), 2)::text AS average
       FROM gold.fact_bowling fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN master.seasons s ON s.sportmonks_id = ff.season_id
       LEFT JOIN master.leagues l ON l.sportmonks_id = ff.league_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ff.season_id, s.name, ff.league_id, l.name, ff.match_format
       ORDER BY s.name DESC NULLS LAST, ff.season_id DESC`,
      params,
    );

    const seasonMap = new Map<string, PlayerCareerSeasonDto>();

    for (const row of batting.rows) {
      const key = `${row.season_id}:${row.league_id}:${row.match_format}`;
      seasonMap.set(key, {
        seasonId: row.season_id,
        seasonName: row.season_name,
        leagueId: row.league_id,
        leagueName: row.league_name,
        format: row.match_format,
        batting: {
          innings: Number(row.innings),
          runs: Number(row.runs),
          balls: Number(row.balls),
          fours: Number(row.fours),
          sixes: Number(row.sixes),
          strikeRate: row.strike_rate != null ? Number(row.strike_rate) : null,
          average: row.average != null ? Number(row.average) : null,
        },
        bowling: {
          innings: 0,
          overs: 0,
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
          economy: null,
          average: null,
        },
      });
    }

    for (const row of bowling.rows) {
      const key = `${row.season_id}:${row.league_id}:${row.match_format}`;
      const existing = seasonMap.get(key);
      const bowlingStats = {
        innings: Number(row.innings),
        overs: Number(row.overs),
        maidens: Number(row.maidens),
        runsConceded: Number(row.runs_conceded),
        wickets: Number(row.wickets),
        economy: row.economy != null ? Number(row.economy) : null,
        average: row.average != null ? Number(row.average) : null,
      };
      if (existing) {
        existing.bowling = bowlingStats;
      } else {
        seasonMap.set(key, {
          seasonId: row.season_id,
          seasonName: row.season_name,
          leagueId: row.league_id,
          leagueName: row.league_name,
          format: row.match_format,
          batting: {
            innings: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            strikeRate: null,
            average: null,
          },
          bowling: bowlingStats,
        });
      }
    }

    const seasons = [...seasonMap.values()].sort((a, b) =>
      (b.seasonName ?? '').localeCompare(a.seasonName ?? ''),
    );

    const scope = await this.leagues.resolveScope({
      format: filters.format,
      leagueId: filters.leagueId,
    });
    const totalInnings = seasons.reduce(
      (sum, s) => sum + s.batting.innings + s.bowling.innings,
      0,
    );
    const note = await this.leagues.buildStatsNote(
      { format: filters.format, leagueId: filters.leagueId },
      scope,
      totalInnings,
    );

    return {
      playerId: sportmonksId,
      scope,
      seasons,
      note,
    };
  }

  async compare(query: PlayerCompareQueryDto): Promise<PlayerCompareDto> {
    const ids = query.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length < 2 || ids.length > 4) {
      throw new BadRequestException(
        'Provide 2 to 4 comma-separated player ids via ids=',
      );
    }

    const filters: PlayerStatsQueryDto = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };

    const players = [];
    for (const id of ids) {
      const profile = await this.getById(id);
      const batting = await this.getBattingStats(id, filters);
      const bowling = await this.getBowlingStats(id, filters);
      players.push({ profile, batting, bowling });
    }

    const scope = await this.leagues.resolveScope(filters);
    return { scope, players };
  }
}

