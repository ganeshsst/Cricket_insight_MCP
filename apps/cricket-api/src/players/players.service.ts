import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { LeaguesService } from '../leagues/leagues.service.js';
import type {
  DismissalBreakdownRowDto,
  PlayerByNameQueryDto,
  PlayerBattingStatsDto,
  PlayerBowlingStatsDto,
  PlayerCareerDto,
  PlayerCareerQueryDto,
  PlayerCareerSeasonDto,
  PlayerCompareByNameQueryDto,
  PlayerCompareDto,
  PlayerCompareQueryDto,
  PlayerDismissalAnalysisDto,
  PlayerDismissalByNameQueryDto,
  PlayerMatchLogDto,
  PlayerMatchesQueryDto,
  PlayerProfileDto,
  PlayerSearchResultDto,
  PlayerStatsBundleDto,
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

  async search(q: string, limit: number, leagueId?: number): Promise<PlayerSearchResultDto[]> {
    const normalizedQuery = q.trim();
    const { rows } = await this.db.query<PlayerRow>(
      `SELECT sportmonks_id::text, fullname, firstname, lastname,
              country_id::text, position_id::text, dateofbirth::text,
              battingstyle, bowlingstyle, image_path
       FROM master.players p
       WHERE p.is_active IS DISTINCT FROM false
         AND p.fullname ILIKE $1
         AND (
           $2::bigint IS NULL
           OR EXISTS (
             SELECT 1
             FROM master.team_squad_members tsm
             JOIN master.seasons s ON s.sportmonks_id = tsm.season_id
             WHERE tsm.player_id = p.sportmonks_id
               AND s.league_id = $2::bigint
           )
         )
       ORDER BY
         CASE
           WHEN lower(fullname) = lower($3) THEN 0
           WHEN lower(fullname) LIKE lower($3) || '%' THEN 1
           WHEN lower(fullname) LIKE '% ' || lower($3) || '%' THEN 2
           ELSE 3
         END,
         position(lower($3) in lower(fullname)),
         fullname
       LIMIT $4`,
      [`%${normalizedQuery}%`, leagueId ?? null, normalizedQuery, limit],
    );

    return rows.map((row: PlayerRow) => ({
      sportmonksId: row.sportmonks_id,
      fullname: row.fullname,
      firstname: row.firstname,
      lastname: row.lastname,
      countryId: row.country_id,
      battingstyle: row.battingstyle,
      bowlingstyle: row.bowlingstyle,
      imagePath: row.image_path,
      dateofbirth: row.dateofbirth,
      positionId: row.position_id,
    }));
  }

  async getById(sportmonksId: string): Promise<PlayerProfileDto> {
    if (!/^\d+$/.test(sportmonksId.trim())) {
      throw new BadRequestException(
        `sportmonksId must be a numeric SportMonks id, got "${sportmonksId}". Use /players/by-name/* or search_players first.`,
      );
    }

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

  async getStatsByName(query: PlayerByNameQueryDto): Promise<PlayerStatsBundleDto> {
    const player = await this.resolveByName(query.q, query.leagueId);
    const filters: PlayerStatsQueryDto = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };
    const [profile, batting, bowling] = await Promise.all([
      this.getById(player.sportmonksId),
      this.getBattingStats(player.sportmonksId, filters),
      this.getBowlingStats(player.sportmonksId, filters),
    ]);

    return { profile, batting, bowling };
  }

  async getBattingStats(
    sportmonksId: string,
    filters: PlayerStatsQueryDto,
  ): Promise<PlayerBattingStatsDto> {
    await this.getById(sportmonksId);

    const { params, conditions } = this.careerFilterClauses(sportmonksId, filters);

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
      `SELECT pcs.player_id::text,
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
       LEFT JOIN master.seasons s ON s.sportmonks_id = pcs.season_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pcs.player_id`,
      params,
    );

    const row = rows[0];
    const scope = await this.leagues.resolveScope(filters);
    const innings = Number(row?.innings ?? 0);
    const note = this.careerStatsNote(filters, innings);

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

    const { params, conditions } = this.careerFilterClauses(sportmonksId, filters);

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
      `SELECT pcs.player_id::text,
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
       LEFT JOIN master.seasons s ON s.sportmonks_id = pcs.season_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pcs.player_id`,
      params,
    );

    const row = rows[0];
    const scope = await this.leagues.resolveScope(filters);
    const innings = Number(row?.innings ?? 0);
    const note = this.careerStatsNote(filters, innings);

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

    const { params, conditions } = this.careerFilterClauses(sportmonksId, filters);

    const { rows } = await this.db.query<{
      season_id: string;
      season_name: string | null;
      league_id: string | null;
      league_name: string | null;
      format_type: string | null;
      batting_innings: string;
      batting_runs: string;
      batting_balls: string;
      batting_fours: string;
      batting_sixes: string;
      batting_strike_rate: string | null;
      batting_average: string | null;
      bowling_innings: string;
      bowling_overs: string;
      bowling_maidens: string;
      bowling_runs: string;
      bowling_wickets: string;
      bowling_economy: string | null;
      bowling_average: string | null;
    }>(
      `SELECT pcs.season_id::text,
              s.name AS season_name,
              s.league_id::text,
              l.name AS league_name,
              pcs.format_type,
              COALESCE(pcs.batting_innings, 0)::text AS batting_innings,
              COALESCE(pcs.batting_runs, 0)::text AS batting_runs,
              COALESCE(pcs.batting_balls_faced, 0)::text AS batting_balls,
              COALESCE(pcs.batting_fours, 0)::text AS batting_fours,
              COALESCE(pcs.batting_sixes, 0)::text AS batting_sixes,
              pcs.batting_strike_rate::text AS batting_strike_rate,
              pcs.batting_average::text AS batting_average,
              COALESCE(pcs.bowling_innings, 0)::text AS bowling_innings,
              COALESCE(pcs.bowling_overs, 0)::text AS bowling_overs,
              COALESCE(pcs.bowling_maidens, 0)::text AS bowling_maidens,
              COALESCE(pcs.bowling_runs, 0)::text AS bowling_runs,
              COALESCE(pcs.bowling_wickets, 0)::text AS bowling_wickets,
              pcs.bowling_economy_rate::text AS bowling_economy,
              pcs.bowling_average::text AS bowling_average
       FROM master.player_career_stats pcs
       LEFT JOIN master.seasons s ON s.sportmonks_id = pcs.season_id
       LEFT JOIN master.leagues l ON l.sportmonks_id = s.league_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.name DESC NULLS LAST, pcs.season_id DESC`,
      params,
    );

    const seasons: PlayerCareerSeasonDto[] = rows.map((row: (typeof rows)[number]) => ({
      seasonId: row.season_id,
      seasonName: row.season_name,
      leagueId: row.league_id,
      leagueName: row.league_name,
      format: row.format_type,
      batting: {
        innings: Number(row.batting_innings),
        runs: Number(row.batting_runs),
        balls: Number(row.batting_balls),
        fours: Number(row.batting_fours),
        sixes: Number(row.batting_sixes),
        strikeRate:
          row.batting_strike_rate != null ? Number(row.batting_strike_rate) : null,
        average: row.batting_average != null ? Number(row.batting_average) : null,
      },
      bowling: {
        innings: Number(row.bowling_innings),
        overs: Number(row.bowling_overs),
        maidens: Number(row.bowling_maidens),
        runsConceded: Number(row.bowling_runs),
        wickets: Number(row.bowling_wickets),
        economy: row.bowling_economy != null ? Number(row.bowling_economy) : null,
        average: row.bowling_average != null ? Number(row.bowling_average) : null,
      },
    }));

    const scope = await this.leagues.resolveScope({
      format: filters.format,
      leagueId: filters.leagueId,
    });
    const totalInnings = seasons.reduce(
      (sum, s) => sum + s.batting.innings + s.bowling.innings,
      0,
    );

    return {
      playerId: sportmonksId,
      scope,
      seasons,
      note: this.careerStatsNote(filters, totalInnings),
    };
  }

  async getMatches(
    sportmonksId: string,
    filters: PlayerMatchesQueryDto,
  ): Promise<PlayerMatchLogDto> {
    await this.getById(sportmonksId);

    const params: unknown[] = [sportmonksId];
    const conditions = [
      `(bat.fixture_id IS NOT NULL OR bowl.fixture_id IS NOT NULL)`,
    ];
    if (filters.leagueId) {
      params.push(filters.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }
    if (filters.seasonId) {
      params.push(filters.seasonId);
      conditions.push(`ff.season_id = $${params.length}::bigint`);
    }
    if (filters.format) {
      params.push(filters.format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    params.push(filters.limit ?? 20);
    const limitParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      fixture_id: string;
      date_key: string | null;
      league_id: string | null;
      season_id: string | null;
      local_team_name: string | null;
      visitor_team_name: string | null;
      runs_scored: number | null;
      balls_faced: number | null;
      fours: number | null;
      sixes: number | null;
      batting_strike_rate: string | null;
      overs: string | null;
      runs_conceded: number | null;
      wickets: number | null;
      economy_rate: string | null;
    }>(
      `WITH bat AS (
         SELECT fixture_id,
                SUM(runs_scored)::int AS runs_scored,
                SUM(balls_faced)::int AS balls_faced,
                SUM(fours)::int AS fours,
                SUM(sixes)::int AS sixes,
                CASE
                  WHEN SUM(balls_faced) > 0
                  THEN ROUND((SUM(runs_scored)::numeric * 100) / SUM(balls_faced), 2)
                  ELSE NULL
                END AS strike_rate
         FROM matches.fixture_batting
         WHERE player_id = $1::bigint
         GROUP BY fixture_id
       ),
       bowl AS (
         SELECT fixture_id,
                SUM(overs)::numeric AS overs,
                SUM(runs_conceded)::int AS runs_conceded,
                SUM(wickets)::int AS wickets,
                CASE
                  WHEN SUM(overs) > 0
                  THEN ROUND(SUM(runs_conceded)::numeric / SUM(overs), 2)
                  ELSE NULL
                END AS economy_rate
         FROM matches.fixture_bowling
         WHERE player_id = $1::bigint
         GROUP BY fixture_id
       )
       SELECT ff.fixture_id::text,
              ff.date_key::text,
              ff.league_id::text,
              ff.season_id::text,
              lt.name AS local_team_name,
              vt.name AS visitor_team_name,
              bat.runs_scored,
              bat.balls_faced,
              bat.fours,
              bat.sixes,
              bat.strike_rate::text AS batting_strike_rate,
              bowl.overs::text,
              bowl.runs_conceded,
              bowl.wickets,
              bowl.economy_rate::text
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       LEFT JOIN bat ON bat.fixture_id = ff.fixture_id
       LEFT JOIN bowl ON bowl.fixture_id = ff.fixture_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC
       LIMIT ${limitParam}`,
      params,
    );

    return {
      playerId: sportmonksId,
      matches: rows.map((row: (typeof rows)[number]) => ({
        fixtureId: row.fixture_id,
        date: row.date_key,
        leagueId: row.league_id,
        seasonId: row.season_id,
        localTeamName: row.local_team_name,
        visitorTeamName: row.visitor_team_name,
        runs: row.runs_scored,
        balls: row.balls_faced,
        fours: row.fours,
        sixes: row.sixes,
        battingStrikeRate:
          row.batting_strike_rate != null ? Number(row.batting_strike_rate) : null,
        overs: row.overs != null ? Number(row.overs) : null,
        runsConceded: row.runs_conceded,
        wickets: row.wickets,
        economy: row.economy_rate != null ? Number(row.economy_rate) : null,
      })),
      note:
        rows.length === 0
          ? 'No fixture-level scorecard rows found for this player/filter scope.'
          : undefined,
    };
  }

  async getDismissalsByName(
    query: PlayerDismissalByNameQueryDto,
  ): Promise<PlayerDismissalAnalysisDto> {
    const player = await this.resolveByName(query.q, query.leagueId);
    return this.getDismissals(player.sportmonksId, {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    });
  }

  /**
   * Data-grounded batting weakness profile built from scorecard dismissal rows:
   * how the batter gets out, against pace vs spin, by bowling style, and by phase.
   */
  async getDismissals(
    sportmonksId: string,
    filters: PlayerStatsQueryDto,
  ): Promise<PlayerDismissalAnalysisDto> {
    const profile = await this.getById(sportmonksId);

    const params: unknown[] = [sportmonksId];
    const conditions = ['fb.player_id = $1::bigint', 'fb.wicket_outcome_id IS NOT NULL'];

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

    const { rows } = await this.db.query<{
      outcome: string | null;
      bowler_style: string | null;
      fow_balls: string | null;
      format: string | null;
    }>(
      `SELECT so.name AS outcome,
              bp.bowlingstyle AS bowler_style,
              fb.fow_balls::text AS fow_balls,
              ff.match_format AS format
       FROM matches.fixture_batting fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
       LEFT JOIN master.players bp ON bp.sportmonks_id = fb.bowling_player_id
       WHERE ${conditions.join(' AND ')}`,
      params,
    );

    const scope = await this.leagues.resolveScope(filters);

    // Outcomes that are not a bowler/fielding dismissal of the batter.
    const nonDismissal = new Set(['not out', 'retired hurt', 'absent']);
    let notOuts = 0;
    const dismissalTypeCounts = new Map<string, number>();
    const bowlerTypeCounts = new Map<string, number>();
    const bowlingStyleCounts = new Map<string, number>();
    const phaseCounts = new Map<string, number>();

    for (const row of rows) {
      const outcome = (row.outcome ?? 'Unknown').trim();
      const normalized = outcome.toLowerCase();
      if (normalized === 'not out') {
        notOuts += 1;
        continue;
      }
      if (nonDismissal.has(normalized)) {
        continue;
      }

      dismissalTypeCounts.set(outcome, (dismissalTypeCounts.get(outcome) ?? 0) + 1);

      const bowlerType = this.classifyBowlerType(row.bowler_style);
      bowlerTypeCounts.set(bowlerType, (bowlerTypeCounts.get(bowlerType) ?? 0) + 1);

      const style = row.bowler_style ?? 'unknown';
      bowlingStyleCounts.set(style, (bowlingStyleCounts.get(style) ?? 0) + 1);

      const phase = this.classifyPhase(row.fow_balls, row.format);
      phaseCounts.set(phase, (phaseCounts.get(phase) ?? 0) + 1);
    }

    const totalDismissals = [...dismissalTypeCounts.values()].reduce(
      (sum, n) => sum + n,
      0,
    );

    return {
      playerId: sportmonksId,
      playerName: profile.fullname,
      imagePath: profile.imagePath,
      scope,
      totalDismissals,
      notOuts,
      byDismissalType: this.toBreakdown(dismissalTypeCounts, totalDismissals),
      byBowlerType: this.toBreakdown(bowlerTypeCounts, totalDismissals),
      byBowlingStyle: this.toBreakdown(bowlingStyleCounts, totalDismissals),
      byPhase: this.toBreakdown(phaseCounts, totalDismissals),
      note:
        totalDismissals === 0
          ? 'No scorecard dismissal rows found for this player/filter scope. Ball-by-ball scorecards are only partially ingested, so this reflects loaded fixtures only.'
          : 'Derived from ingested scorecard dismissal rows; coverage is partial, so treat as indicative rather than a complete career record.',
    };
  }

  private classifyBowlerType(style: string | null): 'pace' | 'spin' | 'unknown' {
    if (!style) return 'unknown';
    const s = style.toLowerCase();
    if (s.includes('fast') || s.includes('medium') || s.includes('seam')) {
      return 'pace';
    }
    if (
      s.includes('orthodox') ||
      s.includes('legbreak') ||
      s.includes('googly') ||
      s.includes('offbreak') ||
      s.includes('chinaman') ||
      s.includes('slow') ||
      s.includes('spin')
    ) {
      return 'spin';
    }
    return 'unknown';
  }

  private classifyPhase(fowBalls: string | null, format: string | null): string {
    if (!fowBalls) return 'unknown';
    const over = Math.floor(Number(fowBalls));
    if (Number.isNaN(over)) return 'unknown';

    const f = (format ?? '').toUpperCase();
    if (f === 'T20' || f === 'T20I') {
      if (over < 6) return 'powerplay';
      if (over < 16) return 'middle';
      return 'death';
    }
    if (f === 'ODI') {
      if (over < 10) return 'powerplay';
      if (over < 40) return 'middle';
      return 'death';
    }
    return 'other';
  }

  private toBreakdown(
    counts: Map<string, number>,
    total: number,
  ): DismissalBreakdownRowDto[] {
    return [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Filters for SportMonks per-season career aggregates (not incomplete scorecards). */
  private careerFilterClauses(
    sportmonksId: string,
    filters: { format?: string; leagueId?: number; seasonId?: number },
  ): { params: unknown[]; conditions: string[] } {
    const params: unknown[] = [sportmonksId];
    const conditions = ['pcs.player_id = $1::bigint'];

    if (filters.format) {
      if (filters.format.toLowerCase().startsWith('test')) {
        conditions.push(`pcs.format_type ILIKE 'Test%'`);
      } else {
        params.push(filters.format);
        conditions.push(`pcs.format_type = $${params.length}`);
      }
    }
    if (filters.leagueId) {
      params.push(filters.leagueId);
      conditions.push(`s.league_id = $${params.length}::bigint`);
    }
    if (filters.seasonId) {
      params.push(filters.seasonId);
      conditions.push(`pcs.season_id = $${params.length}::bigint`);
    }

    return { params, conditions };
  }

  private careerStatsNote(
    filters: { format?: string; leagueId?: number; seasonId?: number },
    innings: number,
  ): string | undefined {
    if (filters.format === 'T20I' && filters.leagueId === 1) {
      return 'IPL uses format=T20, not T20I. Remove format=T20I or set format=T20 for Indian Premier League.';
    }
    if (!filters.leagueId && !filters.seasonId && !filters.format) {
      return 'No filters applied — totals include all career seasons currently loaded (mixed leagues/formats). For IPL use leagueId=1.';
    }
    if (innings === 0) {
      return 'No career stats found for this filter scope in the database.';
    }
    return undefined;
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

  async compareByName(query: PlayerCompareByNameQueryDto): Promise<PlayerCompareDto> {
    const [playerA, playerB] = await Promise.all([
      this.resolveByName(query.a, query.leagueId),
      this.resolveByName(query.b, query.leagueId),
    ]);

    return this.compare({
      ids: `${playerA.sportmonksId},${playerB.sportmonksId}`,
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    });
  }

  private async resolveByName(
    q: string,
    leagueId?: number,
  ): Promise<PlayerSearchResultDto> {
    const [scoped] = leagueId ? await this.search(q, 1, leagueId) : [];
    if (scoped) return scoped;

    const [global] = await this.search(q, 1);
    if (global) return global;

    throw new NotFoundException(`Player matching "${q}" not found`);
  }
}

