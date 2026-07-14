import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  BattingLeaderboardRowDto,
  BowlingLeaderboardRowDto,
  LeagueDto,
  SeasonCoverageDto,
  SeasonDto,
  SeasonLeaderboardDto,
  SeasonStandingsDto,
  StandingRowDto,
} from './dto/league.dto.js';

@Injectable()
export class LeaguesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async search(q: string): Promise<LeagueDto[]> {
    const { rows } = await this.db.query<{
      sportmonks_id: string;
      name: string;
      code: string | null;
    }>(
      `SELECT sportmonks_id::text, name, code
       FROM master.leagues
       WHERE name ILIKE $1 OR code ILIKE $1
       ORDER BY name
       LIMIT 20`,
      [`%${q}%`],
    );

    return rows.map((row) => ({
      sportmonksId: row.sportmonks_id,
      name: row.name,
      code: row.code,
    }));
  }

  async listSeasons(leagueId: string): Promise<SeasonDto[]> {
    const { rows } = await this.db.query<{
      sportmonks_id: string;
      name: string;
      league_id: string;
      league_name: string;
    }>(
      `SELECT s.sportmonks_id::text, s.name, s.league_id::text, l.name AS league_name
       FROM master.seasons s
       JOIN master.leagues l ON l.sportmonks_id = s.league_id
       WHERE s.league_id = $1::bigint
       ORDER BY s.name DESC`,
      [leagueId],
    );

    return rows.map((row) => ({
      sportmonksId: row.sportmonks_id,
      name: row.name,
      leagueId: row.league_id,
      leagueName: row.league_name,
    }));
  }

  async resolveScope(filters: {
    format?: string;
    leagueId?: number;
    seasonId?: number;
  }): Promise<{
    format: string | null;
    leagueId: string | null;
    leagueName: string | null;
    seasonId: string | null;
    seasonName: string | null;
  }> {
    let leagueName: string | null = null;
    let seasonName: string | null = null;

    if (filters.leagueId) {
      const league = await this.db.query<{ name: string }>(
        `SELECT name FROM master.leagues WHERE sportmonks_id = $1::bigint`,
        [filters.leagueId],
      );
      leagueName = league.rows[0]?.name ?? null;
    }

    if (filters.seasonId) {
      const season = await this.db.query<{ name: string }>(
        `SELECT name FROM master.seasons WHERE sportmonks_id = $1::bigint`,
        [filters.seasonId],
      );
      seasonName = season.rows[0]?.name ?? null;
    }

    return {
      format: filters.format ?? null,
      leagueId: filters.leagueId ? String(filters.leagueId) : null,
      leagueName,
      seasonId: filters.seasonId ? String(filters.seasonId) : null,
      seasonName,
    };
  }

  async getSeasonCoverage(
    leagueId: string,
    seasonId: string,
  ): Promise<SeasonCoverageDto> {
    const scope = await this.resolveScope({
      leagueId: Number(leagueId),
      seasonId: Number(seasonId),
    });

    const coverage = await this.queryCoverageCounts(seasonId);
    const standings = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM gold.fact_standing
       WHERE season_id = $1::bigint AND league_id = $2::bigint`,
      [seasonId, leagueId],
    );

    const note = this.coverageNote(coverage);

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      totalFixtures: coverage.seasonFixtures,
      fixturesWithBatting: coverage.battingFixtures,
      fixturesWithBowling: coverage.bowlingFixtures,
      standingsTeams: Number(standings.rows[0]?.count ?? 0),
      note,
    };
  }

  async getStandings(
    leagueId: string,
    seasonId: string,
  ): Promise<SeasonStandingsDto> {
    const scope = await this.resolveScope({
      leagueId: Number(leagueId),
      seasonId: Number(seasonId),
    });

    const { rows } = await this.db.query<{
      position: number;
      team_id: string;
      team_name: string | null;
      points: number;
      played: number;
      won: number;
      lost: number;
      draw: number;
      noresult: number;
      net_run_rate: string | null;
      recent_form: string[] | null;
    }>(
      `SELECT fs.position,
              fs.team_id::text,
              t.name AS team_name,
              fs.points,
              fs.played,
              fs.won,
              fs.lost,
              fs.draw,
              fs.noresult,
              fs.net_run_rate::text,
              fs.recent_form
       FROM gold.fact_standing fs
       LEFT JOIN master.teams t ON t.sportmonks_id = fs.team_id
       WHERE fs.league_id = $1::bigint AND fs.season_id = $2::bigint
       ORDER BY fs.position ASC NULLS LAST, fs.points DESC`,
      [leagueId, seasonId],
    );

    const standings: StandingRowDto[] = rows.map((row) => ({
      position: Number(row.position),
      teamId: row.team_id,
      teamName: row.team_name,
      points: Number(row.points),
      played: Number(row.played),
      won: Number(row.won),
      lost: Number(row.lost),
      draw: Number(row.draw),
      noResult: Number(row.noresult),
      netRunRate: row.net_run_rate != null ? Number(row.net_run_rate) : null,
      recentForm: row.recent_form,
    }));

    const coverage = await this.queryCoverageCounts(seasonId);

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      standings,
      note: this.coverageNote(coverage),
    };
  }

  async getBattingLeaderboard(
    leagueId: string,
    seasonId: string,
    format?: string,
    limit = 20,
  ): Promise<SeasonLeaderboardDto> {
    const scope = await this.resolveScope({
      format,
      leagueId: Number(leagueId),
      seasonId: Number(seasonId),
    });

    const params: unknown[] = [leagueId, seasonId];
    const conditions = [
      'ff.league_id = $1::bigint',
      'ff.season_id = $2::bigint',
    ];
    if (format) {
      params.push(format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      innings: string;
      runs: string;
      balls: string;
      fours: string;
      sixes: string;
      strike_rate: string | null;
      average: string | null;
    }>(
      `SELECT fb.player_id::text,
              p.fullname AS player_name,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.runs_scored), 0)::text AS runs,
              COALESCE(SUM(fb.balls_faced), 0)::text AS balls,
              COALESCE(SUM(fb.fours), 0)::text AS fours,
              COALESCE(SUM(fb.sixes), 0)::text AS sixes,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(SUM(fb.balls_faced), 0) * 100, 2)::text AS strike_rate,
              ROUND(COALESCE(SUM(fb.runs_scored), 0)::numeric / NULLIF(COUNT(DISTINCT fb.fixture_id), 0), 2)::text AS average
       FROM gold.fact_batting fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN master.players p ON p.sportmonks_id = fb.player_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY fb.player_id, p.fullname
       ORDER BY SUM(fb.runs_scored) DESC NULLS LAST, COUNT(DISTINCT fb.fixture_id) DESC
       LIMIT ${limitParam}`,
      params,
    );

    const batting: BattingLeaderboardRowDto[] = rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      innings: Number(row.innings),
      runs: Number(row.runs),
      balls: Number(row.balls),
      fours: Number(row.fours),
      sixes: Number(row.sixes),
      strikeRate: row.strike_rate != null ? Number(row.strike_rate) : null,
      average: row.average != null ? Number(row.average) : null,
    }));

    const note = await this.buildStatsNote(
      { format, leagueId: Number(leagueId), seasonId: Number(seasonId) },
      scope,
      batting.length,
    );

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      format: scope.format,
      batting,
      note,
    };
  }

  async getBowlingLeaderboard(
    leagueId: string,
    seasonId: string,
    format?: string,
    limit = 20,
  ): Promise<SeasonLeaderboardDto> {
    const scope = await this.resolveScope({
      format,
      leagueId: Number(leagueId),
      seasonId: Number(seasonId),
    });

    const params: unknown[] = [leagueId, seasonId];
    const conditions = [
      'ff.league_id = $1::bigint',
      'ff.season_id = $2::bigint',
    ];
    if (format) {
      params.push(format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      innings: string;
      overs: string;
      maidens: string;
      runs_conceded: string;
      wickets: string;
      economy: string | null;
      average: string | null;
    }>(
      `SELECT fb.player_id::text,
              p.fullname AS player_name,
              COUNT(DISTINCT fb.fixture_id)::text AS innings,
              COALESCE(SUM(fb.overs), 0)::text AS overs,
              COALESCE(SUM(fb.maidens), 0)::text AS maidens,
              COALESCE(SUM(fb.runs_conceded), 0)::text AS runs_conceded,
              COALESCE(SUM(fb.wickets), 0)::text AS wickets,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.overs), 0), 2)::text AS economy,
              ROUND(COALESCE(SUM(fb.runs_conceded), 0)::numeric / NULLIF(SUM(fb.wickets), 0), 2)::text AS average
       FROM gold.fact_bowling fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN master.players p ON p.sportmonks_id = fb.player_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY fb.player_id, p.fullname
       ORDER BY SUM(fb.wickets) DESC NULLS LAST, SUM(fb.overs) DESC
       LIMIT ${limitParam}`,
      params,
    );

    const bowling: BowlingLeaderboardRowDto[] = rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      innings: Number(row.innings),
      overs: Number(row.overs),
      maidens: Number(row.maidens),
      runsConceded: Number(row.runs_conceded),
      wickets: Number(row.wickets),
      economy: row.economy != null ? Number(row.economy) : null,
      average: row.average != null ? Number(row.average) : null,
    }));

    const note = await this.buildStatsNote(
      { format, leagueId: Number(leagueId), seasonId: Number(seasonId) },
      scope,
      bowling.length,
    );

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      format: scope.format,
      bowling,
      note,
    };
  }

  async buildStatsNote(
    filters: {
      format?: string;
      leagueId?: number;
      seasonId?: number;
    },
    scope: {
      leagueId: string | null;
      seasonId: string | null;
    },
    innings: number,
  ): Promise<string | undefined> {
    if (!filters.leagueId && !filters.seasonId && !filters.format) {
      return 'No filters applied — totals include all batting rows currently loaded in the database (mixed leagues/formats). For IPL 2026 use leagueId=1, seasonId=1795, format=T20.';
    }

    if (filters.format === 'T20I' && filters.leagueId === 1) {
      return 'IPL uses format=T20, not T20I. Remove format=T20I or set format=T20 for Indian Premier League.';
    }

    if (scope.seasonId) {
      const coverage = await this.queryCoverageCounts(scope.seasonId);
      const note = this.coverageNote(coverage);
      if (note) return note;
    }

    if (innings === 0) {
      return 'No batting rows found for this filter scope in the database.';
    }

    return undefined;
  }

  private async queryCoverageCounts(seasonId: string): Promise<{
    seasonFixtures: number;
    battingFixtures: number;
    bowlingFixtures: number;
  }> {
    const coverage = await this.db.query<{
      season_fixtures: string;
      batting_fixtures: string;
      bowling_fixtures: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM gold.fact_fixture WHERE season_id = $1::bigint) AS season_fixtures,
         (SELECT COUNT(DISTINCT fb.fixture_id)
          FROM gold.fact_batting fb
          JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
          WHERE ff.season_id = $1::bigint) AS batting_fixtures,
         (SELECT COUNT(DISTINCT fb.fixture_id)
          FROM gold.fact_bowling fb
          JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
          WHERE ff.season_id = $1::bigint) AS bowling_fixtures`,
      [seasonId],
    );

    return {
      seasonFixtures: Number(coverage.rows[0]?.season_fixtures ?? 0),
      battingFixtures: Number(coverage.rows[0]?.batting_fixtures ?? 0),
      bowlingFixtures: Number(coverage.rows[0]?.bowling_fixtures ?? 0),
    };
  }

  private coverageNote(coverage: {
    seasonFixtures: number;
    battingFixtures: number;
  }): string | undefined {
    if (
      coverage.seasonFixtures > 0 &&
      coverage.battingFixtures < coverage.seasonFixtures
    ) {
      return `Batting data is partially loaded for this season (${coverage.battingFixtures}/${coverage.seasonFixtures} fixtures have scorecard rows). Stats may be lower than official sources until ingest completes.`;
    }
    return undefined;
  }
}
