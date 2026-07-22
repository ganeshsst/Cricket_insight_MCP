import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  BattingLeaderboardRowDto,
  BowlingLeaderboardRowDto,
  LeagueDto,
  ResolvedSeasonDto,
  SeasonAwardsDto,
  SeasonCoverageDto,
  SeasonDto,
  SeasonLeaderboardDto,
  SeasonPlayoffMatchDto,
  SeasonPlayoffsDto,
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

    return rows.map((row: (typeof rows)[number]) => ({
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

    return rows.map((row: (typeof rows)[number]) => ({
      sportmonksId: row.sportmonks_id,
      name: row.name,
      leagueId: row.league_id,
      leagueName: row.league_name,
    }));
  }

  async resolveSeasonQuery(q: string): Promise<ResolvedSeasonDto> {
    const year = q.match(/\b(19|20)\d{2}\b/)?.[0];
    const leagueQuery = q
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const [league] = await this.search(leagueQuery || q);
    if (!league) {
      throw new NotFoundException(`League matching "${q}" not found`);
    }

    const seasons = await this.listSeasons(league.sportmonksId);
    const season = year
      ? seasons.find((s) => s.name === year || s.name.includes(year))
      : seasons[0];
    if (!season) {
      throw new NotFoundException(`Season matching "${q}" not found`);
    }

    return season;
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
      fixturesWithBalls: coverage.ballFixtures,
      fixturesWithOvers: coverage.overFixtures,
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
              fs.net_run_rate::text
       FROM gold.fact_standing fs
       LEFT JOIN master.teams t ON t.sportmonks_id = fs.team_id
       WHERE fs.league_id = $1::bigint AND fs.season_id = $2::bigint
       ORDER BY fs.position ASC NULLS LAST, fs.points DESC`,
      [leagueId, seasonId],
    );

    const formByTeam = await this.getRecentFormByTeam(seasonId, 5);

    const standings: StandingRowDto[] = rows.map((row: (typeof rows)[number]) => ({
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
      // Derived from finished fixtures — do not use gold.fact_standing.recent_form (often wrong).
      recentForm: formByTeam.get(String(row.team_id).trim()) ?? [],
    }));

    const coverage = await this.queryCoverageCounts(seasonId);
    const baseNote = this.coverageNote(coverage);
    const formNote =
      'recentForm is the last 5 finished matches in the season including playoffs (W/L/NR), oldest→newest (rightmost = most recent).';

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      standings,
      note: baseNote ? `${baseNote} ${formNote}` : formNote,
    };
  }

  /**
   * Last N finished results per team in the season (league + playoffs).
   * Chronological by date_key; rightmost = most recent (e.g. Final counts).
   * Result codes: W / L / NR.
   */
  private async getRecentFormByTeam(
    seasonId: string,
    lastN = 5,
  ): Promise<Map<string, string[]>> {
    const { rows } = await this.db.query<{
      team_id: string;
      result: string;
      rn: string;
    }>(
      `WITH results AS (
         SELECT ff.date_key,
                ff.fixture_id,
                ff.localteam_id::text AS team_id,
                CASE
                  WHEN ff.winner_team_id IS NULL THEN 'NR'
                  WHEN ff.winner_team_id = ff.localteam_id THEN 'W'
                  ELSE 'L'
                END AS result
         FROM gold.fact_fixture ff
         WHERE ff.season_id = $1::bigint
           AND (
             LOWER(TRIM(COALESCE(ff.status, ''))) = 'finished'
             OR ff.winner_team_id IS NOT NULL
           )
           AND ff.localteam_id IS NOT NULL
         UNION ALL
         SELECT ff.date_key,
                ff.fixture_id,
                ff.visitorteam_id::text,
                CASE
                  WHEN ff.winner_team_id IS NULL THEN 'NR'
                  WHEN ff.winner_team_id = ff.visitorteam_id THEN 'W'
                  ELSE 'L'
                END
         FROM gold.fact_fixture ff
         WHERE ff.season_id = $1::bigint
           AND (
             LOWER(TRIM(COALESCE(ff.status, ''))) = 'finished'
             OR ff.winner_team_id IS NOT NULL
           )
           AND ff.visitorteam_id IS NOT NULL
       ),
       ranked AS (
         SELECT team_id,
                result,
                ROW_NUMBER() OVER (
                  PARTITION BY team_id
                  ORDER BY date_key DESC NULLS LAST, fixture_id DESC
                ) AS rn
         FROM results
       )
       SELECT team_id, result, rn::text
       FROM ranked
       WHERE rn <= $2::int
       ORDER BY team_id, rn DESC`,
      [seasonId, lastN],
    );

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const teamId = String(row.team_id).trim();
      if (!teamId) continue;
      const list = map.get(teamId) ?? [];
      list.push(row.result);
      map.set(teamId, list);
    }
    return map;
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
      's.league_id = $1::bigint',
      'pcs.season_id = $2::bigint',
    ];
    if (format) {
      if (format.toLowerCase().startsWith('test')) {
        conditions.push(`pcs.format_type ILIKE 'Test%'`);
      } else {
        params.push(format);
        conditions.push(`pcs.format_type = $${params.length}`);
      }
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      innings: string;
      runs: string;
      balls: string;
      fours: string;
      sixes: string;
      strike_rate: string | null;
      average: string | null;
    }>(
      `SELECT pcs.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              COALESCE(SUM(pcs.batting_innings), 0)::text AS innings,
              COALESCE(SUM(pcs.batting_runs), 0)::text AS runs,
              COALESCE(SUM(pcs.batting_balls_faced), 0)::text AS balls,
              COALESCE(SUM(pcs.batting_fours), 0)::text AS fours,
              COALESCE(SUM(pcs.batting_sixes), 0)::text AS sixes,
              ROUND(
                COALESCE(SUM(pcs.batting_runs), 0)::numeric
                / NULLIF(SUM(pcs.batting_balls_faced), 0) * 100,
                2
              )::text AS strike_rate,
              ROUND(
                COALESCE(SUM(pcs.batting_runs), 0)::numeric
                / NULLIF(SUM(pcs.batting_innings) - SUM(pcs.batting_not_outs), 0),
                2
              )::text AS average
       FROM master.player_career_stats pcs
       JOIN master.seasons s ON s.sportmonks_id = pcs.season_id
       LEFT JOIN master.players p ON p.sportmonks_id = pcs.player_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pcs.player_id, p.fullname, p.image_path
       ORDER BY SUM(pcs.batting_runs) DESC NULLS LAST, SUM(pcs.batting_innings) DESC
       LIMIT ${limitParam}`,
      params,
    );

    const batting: BattingLeaderboardRowDto[] = rows.map((row: (typeof rows)[number]) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      imagePath: row.image_path,
      innings: Number(row.innings),
      runs: Number(row.runs),
      balls: Number(row.balls),
      fours: Number(row.fours),
      sixes: Number(row.sixes),
      strikeRate: row.strike_rate != null ? Number(row.strike_rate) : null,
      average: row.average != null ? Number(row.average) : null,
    }));

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      format: scope.format,
      batting,
      note:
        batting.length === 0
          ? 'No career batting stats found for this filter scope in the database.'
          : undefined,
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
      's.league_id = $1::bigint',
      'pcs.season_id = $2::bigint',
    ];
    if (format) {
      if (format.toLowerCase().startsWith('test')) {
        conditions.push(`pcs.format_type ILIKE 'Test%'`);
      } else {
        params.push(format);
        conditions.push(`pcs.format_type = $${params.length}`);
      }
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      innings: string;
      overs: string;
      maidens: string;
      runs_conceded: string;
      wickets: string;
      economy: string | null;
      average: string | null;
    }>(
      `SELECT pcs.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              COALESCE(SUM(pcs.bowling_innings), 0)::text AS innings,
              COALESCE(SUM(pcs.bowling_overs), 0)::text AS overs,
              COALESCE(SUM(pcs.bowling_maidens), 0)::text AS maidens,
              COALESCE(SUM(pcs.bowling_runs), 0)::text AS runs_conceded,
              COALESCE(SUM(pcs.bowling_wickets), 0)::text AS wickets,
              ROUND(
                COALESCE(SUM(pcs.bowling_runs), 0)::numeric
                / NULLIF(SUM(pcs.bowling_overs), 0),
                2
              )::text AS economy,
              ROUND(
                COALESCE(SUM(pcs.bowling_runs), 0)::numeric
                / NULLIF(SUM(pcs.bowling_wickets), 0),
                2
              )::text AS average
       FROM master.player_career_stats pcs
       JOIN master.seasons s ON s.sportmonks_id = pcs.season_id
       LEFT JOIN master.players p ON p.sportmonks_id = pcs.player_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pcs.player_id, p.fullname, p.image_path
       ORDER BY SUM(pcs.bowling_wickets) DESC NULLS LAST, SUM(pcs.bowling_overs) DESC
       LIMIT ${limitParam}`,
      params,
    );

    const bowling: BowlingLeaderboardRowDto[] = rows.map((row: (typeof rows)[number]) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      imagePath: row.image_path,
      innings: Number(row.innings),
      overs: Number(row.overs),
      maidens: Number(row.maidens),
      runsConceded: Number(row.runs_conceded),
      wickets: Number(row.wickets),
      economy: row.economy != null ? Number(row.economy) : null,
      average: row.average != null ? Number(row.average) : null,
    }));

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      format: scope.format,
      bowling,
      note:
        bowling.length === 0
          ? 'No career bowling stats found for this filter scope in the database.'
          : undefined,
    };
  }

  async getSeasonAwards(
    leagueId: string,
    seasonId: string,
    format?: string,
  ): Promise<SeasonAwardsDto> {
    const [batting, bowling] = await Promise.all([
      this.getBattingLeaderboard(leagueId, seasonId, format, 1),
      this.getBowlingLeaderboard(leagueId, seasonId, format, 1),
    ]);
    const orange = batting.batting?.[0] ?? null;
    const purple = bowling.bowling?.[0] ?? null;

    return {
      leagueId,
      seasonId,
      leagueName: batting.leagueName ?? bowling.leagueName,
      seasonName: batting.seasonName ?? bowling.seasonName,
      format: batting.format ?? bowling.format,
      orangeCap: orange
        ? {
            playerId: orange.playerId,
            playerName: orange.playerName,
            imagePath: orange.imagePath,
            innings: orange.innings,
            runs: orange.runs,
            strikeRate: orange.strikeRate,
            average: orange.average,
          }
        : null,
      purpleCap: purple
        ? {
            playerId: purple.playerId,
            playerName: purple.playerName,
            imagePath: purple.imagePath,
            innings: purple.innings,
            wickets: purple.wickets,
            economy: purple.economy,
            average: purple.average,
          }
        : null,
    };
  }

  async getSeasonPlayoffs(
    leagueId: string,
    seasonId: string,
  ): Promise<SeasonPlayoffsDto> {
    const scope = await this.resolveScope({
      leagueId: Number(leagueId),
      seasonId: Number(seasonId),
    });
    const { rows } = await this.db.query<{
      fixture_id: string;
      date_key: string | null;
      localteam_id: string | null;
      visitorteam_id: string | null;
      winner_team_id: string | null;
      local_team_name: string | null;
      visitor_team_name: string | null;
    }>(
      `SELECT ff.fixture_id::text,
              ff.date_key::text,
              ff.localteam_id::text,
              ff.visitorteam_id::text,
              ff.winner_team_id::text,
              lt.name AS local_team_name,
              vt.name AS visitor_team_name
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ff.league_id = $1::bigint
         AND ff.season_id = $2::bigint
         AND ff.status ILIKE 'Finished'
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC
       LIMIT 4`,
      [leagueId, seasonId],
    );

    const labels = ['qualifier_1', 'eliminator', 'qualifier_2', 'final'];
    const ordered = [...rows].reverse();
    const playoffs: SeasonPlayoffMatchDto[] = ordered.map((row, index) => ({
      type: labels[Math.max(0, labels.length - ordered.length + index)] ?? 'playoff',
      fixtureId: row.fixture_id,
      date: row.date_key,
      localTeamId: row.localteam_id,
      visitorTeamId: row.visitorteam_id,
      localTeamName: row.local_team_name,
      visitorTeamName: row.visitor_team_name,
      winnerTeamId: row.winner_team_id,
      note: 'Playoff stage inferred from latest finished fixtures; round metadata is not yet ingested.',
    }));

    return {
      leagueId,
      seasonId,
      leagueName: scope.leagueName,
      seasonName: scope.seasonName,
      playoffs,
      note: 'Playoff stage inferred from latest finished fixtures; add round/stage ingest for authoritative labels.',
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
    ballFixtures: number;
    overFixtures: number;
  }> {
    const coverage = await this.db.query<{
      season_fixtures: string;
      batting_fixtures: string;
      bowling_fixtures: string;
      ball_fixtures: string;
      over_fixtures: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM gold.fact_fixture WHERE season_id = $1::bigint) AS season_fixtures,
         (SELECT COUNT(DISTINCT fb.fixture_id)
          FROM matches.fixture_batting fb
          JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
          WHERE ff.season_id = $1::bigint) AS batting_fixtures,
         (SELECT COUNT(DISTINCT fb.fixture_id)
          FROM matches.fixture_bowling fb
          JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
          WHERE ff.season_id = $1::bigint) AS bowling_fixtures,
         (SELECT COUNT(DISTINCT fb.fixture_id)
          FROM matches.fixture_balls fb
          JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
          WHERE ff.season_id = $1::bigint) AS ball_fixtures,
         (SELECT COUNT(DISTINCT fio.fixture_id)
          FROM matches.fixture_inning_overs fio
          JOIN gold.fact_fixture ff ON ff.fixture_id = fio.fixture_id
          WHERE ff.season_id = $1::bigint) AS over_fixtures`,
      [seasonId],
    );

    return {
      seasonFixtures: Number(coverage.rows[0]?.season_fixtures ?? 0),
      battingFixtures: Number(coverage.rows[0]?.batting_fixtures ?? 0),
      bowlingFixtures: Number(coverage.rows[0]?.bowling_fixtures ?? 0),
      ballFixtures: Number(coverage.rows[0]?.ball_fixtures ?? 0),
      overFixtures: Number(coverage.rows[0]?.over_fixtures ?? 0),
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
