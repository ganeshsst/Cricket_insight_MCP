import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { LeaguesService } from '../leagues/leagues.service.js';
import { PlayersService } from '../players/players.service.js';
import type {
  AnalyticsScopeDto,
  MultiDismissalEventDto,
  MultiDismissalMode,
  MultiDismissalRowDto,
  MultiDismissalsDto,
  MultiDismissalsQueryDto,
  PerformanceRowDto,
  PerformanceSort,
  PlayerPerformancesDto,
  PlayerPerformancesQueryDto,
  PlayerRankingsDto,
  PlayerRankingsQueryDto,
  PlayerVsBowlingDto,
  PlayerVsBowlingQueryDto,
  RankingMetric,
  RankingRowDto,
  RankingWindow,
  VsBowlingBallStatsDto,
  VsBowlingFailInningDto,
  VsBowlingType,
} from './dto/analytics.dto.js';

/** SQL boolean expression: bowler style matches vs type. Alias must be `bp`. */
export function bowlerStyleMatchesSql(vs: VsBowlingType, alias = 'bp'): string {
  const s = `LOWER(COALESCE(${alias}.bowlingstyle, ''))`;
  const isSpin = `(${s} LIKE '%orthodox%' OR ${s} LIKE '%legbreak%' OR ${s} LIKE '%leg break%' OR ${s} LIKE '%googly%' OR ${s} LIKE '%offbreak%' OR ${s} LIKE '%off break%' OR ${s} LIKE '%chinaman%' OR ${s} LIKE '%slow%' OR ${s} LIKE '%spin%')`;
  const isPace = `(${s} LIKE '%fast%' OR ${s} LIKE '%medium%' OR ${s} LIKE '%seam%' OR ${s} LIKE '%pace%') AND NOT ${isSpin}`;
  const isLeft = `(${s} LIKE '%left%')`;
  const isRight = `(${s} LIKE '%right%' OR (${s} NOT LIKE '%left%' AND ${s} <> ''))`;

  switch (vs) {
    case 'any':
      return 'TRUE';
    case 'pace':
      return `(${isPace})`;
    case 'spin':
      return `(${isSpin})`;
    case 'left_arm_pace':
      return `(${isPace} AND ${isLeft})`;
    case 'right_arm_pace':
      return `(${isPace} AND ${isRight})`;
    case 'left_arm_spin':
      return `(${isSpin} AND ${isLeft})`;
    case 'right_arm_spin':
      return `(${isSpin} AND ${isRight})`;
    default:
      return 'FALSE';
  }
}

const STRUGGLE_DEFINITION =
  'Flagged when (a) ≥35% of dismissals are to this bowling type with ≥5 total dismissals, or (b) ball-by-ball SR vs this type is ≤85% of overall SR with ≥30 balls faced vs type.';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
    @Inject(PlayersService) private readonly players: PlayersService,
  ) {}

  async getPlayerRankings(
    query: PlayerRankingsQueryDto,
  ): Promise<PlayerRankingsDto> {
    const metric = query.metric ?? 'runs';
    const window = query.window ?? 'career';
    const limit = query.limit ?? 10;
    const minInnings = query.minInnings ?? 1;
    const lastN = query.lastN ?? 20;

    const team = await this.resolveTeam(query.teamId, query.teamName);
    const filters = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };

    if (window === 'season' && !filters.seasonId) {
      throw new BadRequestException(
        'window=season requires seasonId (call resolve_season first)',
      );
    }

    const scope = await this.buildScope(filters, team, {
      window,
      lastN: window === 'last_n_matches' ? lastN : null,
      metric,
    });

    const isBowling =
      metric === 'wickets' || metric === 'economy';

    if (metric === 'dismissals') {
      throw new BadRequestException(
        'metric=dismissals is not supported on rankings; use query_player_vs_bowling for dismissal shares',
      );
    }

    const rows = isBowling
      ? await this.rankBowling(metric, filters, team?.id, window, lastN, limit, minInnings)
      : await this.rankBatting(metric, filters, team?.id, window, lastN, limit, minInnings);

    return {
      scope,
      metric,
      rows,
      note:
        rows.length === 0
          ? 'No ranking rows for this filter scope. Coverage may be partial (especially international T20 / team filters). Try IPL (leagueId=1, format=T20) or a named season.'
          : `Ranked from ingested scorecards (${window}). Treat as indicative when coverage is partial.`,
    };
  }

  async getPlayerVsBowling(
    query: PlayerVsBowlingQueryDto,
  ): Promise<PlayerVsBowlingDto> {
    const vs = query.vs ?? 'left_arm_pace';
    const include = new Set(
      (query.include ?? 'dismissals,ballStats,recentFailInnings')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    const player = await this.resolvePlayer(query.q, query.playerId, query.leagueId);
    const team = await this.resolveTeam(query.teamId, query.teamName);
    const filters = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };
    const scope = await this.buildScope(filters, team, { vs });

    const styleSql = bowlerStyleMatchesSql(vs);
    const params: unknown[] = [player.sportmonksId];
    const conditions = [
      'fb.player_id = $1::bigint',
      'fb.wicket_outcome_id IS NOT NULL',
    ];
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
    if (team?.id) {
      params.push(team.id);
      conditions.push(`fb.team_id = $${params.length}::bigint`);
    }

    const { rows: dismissalRows } = await this.db.query<{
      outcome: string | null;
      bowler_style: string | null;
      matches_vs: boolean;
      fixture_id: string;
      date_key: string | null;
      local_team: string | null;
      visitor_team: string | null;
      runs_scored: number | null;
      balls_faced: number | null;
      bowler_name: string | null;
    }>(
      `SELECT so.name AS outcome,
              bp.bowlingstyle AS bowler_style,
              (${styleSql}) AS matches_vs,
              fb.fixture_id::text,
              ff.date_key::text,
              lt.name AS local_team,
              vt.name AS visitor_team,
              fb.runs_scored,
              fb.balls_faced,
              bp.fullname AS bowler_name
       FROM matches.fixture_batting fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
       LEFT JOIN master.players bp ON bp.sportmonks_id = fb.bowling_player_id
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST`,
      params,
    );

    const nonDismissal = new Set(['not out', 'retired hurt', 'absent']);
    let totalDismissals = 0;
    let dismissalsVsType = 0;
    const typeCounts = new Map<string, number>();
    const recentFailInnings: VsBowlingFailInningDto[] = [];

    for (const row of dismissalRows) {
      const outcome = (row.outcome ?? 'Unknown').trim();
      const normalized = outcome.toLowerCase();
      if (nonDismissal.has(normalized)) continue;
      totalDismissals += 1;
      if (row.matches_vs) {
        dismissalsVsType += 1;
        typeCounts.set(outcome, (typeCounts.get(outcome) ?? 0) + 1);
        if (include.has('recentfailinnings') && recentFailInnings.length < 8) {
          recentFailInnings.push({
            fixtureId: row.fixture_id,
            date: row.date_key,
            matchTitle:
              row.local_team && row.visitor_team
                ? `${row.local_team} vs ${row.visitor_team}`
                : null,
            outcome,
            batterRuns: row.runs_scored,
            batterBalls: row.balls_faced,
            bowlerName: row.bowler_name,
            bowlerStyle: row.bowler_style,
          });
        }
      }
    }

    const dismissalSharePct =
      totalDismissals > 0
        ? Number(((dismissalsVsType / totalDismissals) * 100).toFixed(1))
        : null;

    const byDismissalType = [...typeCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage:
          dismissalsVsType > 0
            ? Number(((count / dismissalsVsType) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const ballStats = include.has('ballstats')
      ? await this.ballStatsVs(player.sportmonksId, vs, filters, team?.id)
      : emptyBallStats();
    const overallBallStats = include.has('ballstats')
      ? await this.ballStatsVs(player.sportmonksId, 'any', filters, team?.id)
      : undefined;

    const reasons: string[] = [];
    if (
      totalDismissals >= 5 &&
      dismissalSharePct != null &&
      dismissalSharePct >= 35
    ) {
      reasons.push(
        `${dismissalSharePct}% of dismissals (${dismissalsVsType}/${totalDismissals}) are to ${vs}`,
      );
    }
    if (
      ballStats.available &&
      ballStats.ballsFaced >= 30 &&
      overallBallStats?.available &&
      overallBallStats.strikeRate != null &&
      ballStats.strikeRate != null &&
      overallBallStats.strikeRate > 0 &&
      ballStats.strikeRate <= overallBallStats.strikeRate * 0.85
    ) {
      reasons.push(
        `SR vs ${vs} (${ballStats.strikeRate}) is ≤85% of overall SR (${overallBallStats.strikeRate}) over ${ballStats.ballsFaced} balls`,
      );
    }

    let note: string;
    if (totalDismissals === 0 && !ballStats.available) {
      note =
        'No dismissal or ball-by-ball rows for this player/filter. Coverage is partial — especially for international fixtures.';
    } else if (!ballStats.available) {
      note =
        'Dismissal-based analysis only; ball-by-ball vs bowling type not available in loaded data. Treat as indicative.';
    } else {
      note =
        'Built from scorecard dismissals + ball-by-ball where bowler style is populated. Coverage may be incomplete.';
    }

    return {
      scope,
      player: {
        playerId: player.sportmonksId,
        name: player.name,
        imagePath: player.imagePath,
      },
      vs,
      totalDismissals,
      dismissalsVsType,
      dismissalSharePct,
      byDismissalType: include.has('dismissals') ? byDismissalType : [],
      ballStats,
      overallBallStats,
      struggle: {
        flagged: reasons.length > 0,
        reasons,
        definition: STRUGGLE_DEFINITION,
      },
      recentFailInnings: include.has('recentfailinnings')
        ? recentFailInnings
        : [],
      note,
    };
  }

  async getPlayerPerformances(
    query: PlayerPerformancesQueryDto,
  ): Promise<PlayerPerformancesDto> {
    const kind = query.kind ?? 'batting';
    const sort = query.sort ?? 'best';
    const limit = query.limit ?? 10;
    const player = await this.resolvePlayer(query.q, query.playerId, query.leagueId);
    const team = await this.resolveTeam(query.teamId, query.teamName);
    const filters = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };
    const scope = await this.buildScope(filters, team, {
      vs: query.vsBowlingType ?? null,
      metric: kind,
    });

    const rows =
      kind === 'bowling'
        ? await this.bowlingPerformances(player.sportmonksId, filters, team?.id, sort, limit)
        : await this.battingPerformances(
            player.sportmonksId,
            filters,
            team?.id,
            sort,
            limit,
            query.vsBowlingType,
          );

    return {
      scope,
      player: {
        playerId: player.sportmonksId,
        name: player.name,
        imagePath: player.imagePath,
      },
      kind,
      sort,
      rows,
      note:
        rows.length === 0
          ? 'No fixture-level performances for this filter scope.'
          : 'Fixture-level rows from ingested scorecards. Use fixtureId with get_match_scorecard for full detail.',
    };
  }

  /**
   * Same-match multi-dismissals from scorecard batting rows (super overs / multi-innings).
   * Excludes not out / retired hurt / absent. Run-outs without bowling_player_id still count
   * for batter_multi_out but are excluded from bowler-grouped modes.
   */
  async getMultiDismissals(
    query: MultiDismissalsQueryDto,
  ): Promise<MultiDismissalsDto> {
    const mode: MultiDismissalMode = query.mode ?? 'batter_multi_out';
    const minDismissals = query.minDismissals ?? 2;
    const limit = query.limit ?? 20;
    const sameBowler =
      mode === 'bowler_multi_wicket' ||
      mode === 'pair_in_match' ||
      Boolean(query.sameBowler);

    let batterProfile: {
      sportmonksId: string;
      name: string | null;
      imagePath: string | null;
    } | null = null;
    let bowlerProfile: {
      sportmonksId: string;
      name: string | null;
      imagePath: string | null;
    } | null = null;

    if (query.batter?.trim() || query.batterId?.trim()) {
      batterProfile = await this.resolvePlayer(
        query.batter,
        query.batterId,
        query.leagueId,
      );
    }
    if (query.bowler?.trim() || query.bowlerId?.trim()) {
      bowlerProfile = await this.resolvePlayer(
        query.bowler,
        query.bowlerId,
        query.leagueId,
      );
    }

    if (mode === 'pair_in_match') {
      if (!batterProfile || !bowlerProfile) {
        throw new BadRequestException(
          'pair_in_match requires batter and bowler (names or ids)',
        );
      }
    }

    const filters = {
      format: query.format,
      leagueId: query.leagueId,
      seasonId: query.seasonId,
    };
    const scope = await this.buildScope(filters, null, { metric: mode });

    const params: unknown[] = [];
    const conditions: string[] = [
      'fb.wicket_outcome_id IS NOT NULL',
      `LOWER(TRIM(COALESCE(so.name, ''))) NOT IN ('not out', 'retired hurt', 'absent')`,
    ];

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
    if (batterProfile) {
      params.push(batterProfile.sportmonksId);
      conditions.push(`fb.player_id = $${params.length}::bigint`);
    }
    if (bowlerProfile) {
      params.push(bowlerProfile.sportmonksId);
      conditions.push(`fb.bowling_player_id = $${params.length}::bigint`);
    }
    if (sameBowler) {
      conditions.push('fb.bowling_player_id IS NOT NULL');
    }

    params.push(minDismissals);
    const minParam = `$${params.length}`;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const groupCols = sameBowler
      ? 'b.fixture_id, b.batter_id, b.bowler_id'
      : 'b.fixture_id, b.batter_id';

    const { rows: groupRows } = await this.db.query<{
      fixture_id: string;
      batter_id: string;
      bowler_id: string | null;
      dismissal_count: string;
      date_key: string | null;
      local_team: string | null;
      visitor_team: string | null;
      batter_name: string | null;
      batter_image: string | null;
      bowler_name: string | null;
    }>(
      `WITH base AS (
         SELECT fb.fixture_id,
                ff.date_key,
                lt.name AS local_team,
                vt.name AS visitor_team,
                fb.player_id AS batter_id,
                bat.fullname AS batter_name,
                bat.image_path AS batter_image,
                fb.bowling_player_id AS bowler_id,
                bowl.fullname AS bowler_name,
                fb.scoreboard,
                so.name AS outcome,
                fb.runs_scored,
                fb.balls_faced,
                fb.id AS batting_row_id
         FROM matches.fixture_batting fb
         JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
         JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
         LEFT JOIN master.players bat ON bat.sportmonks_id = fb.player_id
         LEFT JOIN master.players bowl ON bowl.sportmonks_id = fb.bowling_player_id
         LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
         LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
         WHERE ${conditions.join(' AND ')}
       ),
       grouped AS (
         SELECT ${groupCols},
                COUNT(*)::int AS dismissal_count,
                MAX(b.date_key) AS date_key,
                MAX(b.local_team) AS local_team,
                MAX(b.visitor_team) AS visitor_team,
                MAX(b.batter_name) AS batter_name,
                MAX(b.batter_image) AS batter_image,
                ${sameBowler ? 'MAX(b.bowler_name)' : 'NULL::text'} AS bowler_name
         FROM base b
         GROUP BY ${groupCols}
         HAVING COUNT(*) >= ${minParam}
         ORDER BY MAX(b.date_key) DESC NULLS LAST, COUNT(*) DESC
         LIMIT ${limitParam}
       )
       SELECT g.fixture_id::text,
              g.batter_id::text,
              ${sameBowler ? 'g.bowler_id::text' : 'NULL::text'} AS bowler_id,
              g.dismissal_count::text,
              g.date_key::text,
              g.local_team,
              g.visitor_team,
              g.batter_name,
              g.batter_image,
              g.bowler_name
       FROM grouped g`,
      params,
    );

    if (groupRows.length === 0) {
      return {
        scope,
        mode,
        minDismissals,
        sameBowler,
        batter: batterProfile
          ? {
              playerId: batterProfile.sportmonksId,
              name: batterProfile.name,
              imagePath: batterProfile.imagePath,
            }
          : null,
        bowler: bowlerProfile
          ? {
              playerId: bowlerProfile.sportmonksId,
              name: bowlerProfile.name,
              imagePath: bowlerProfile.imagePath,
            }
          : null,
        rows: [],
        note:
          'No same-match multi-dismissal cases found for this filter scope in ingested scorecards. Coverage is partial.',
      };
    }

    // Fetch dismissal event rows for the matched groups
    const detailParams: unknown[] = [];
    const detailConditions = [
      'fb.wicket_outcome_id IS NOT NULL',
      `LOWER(TRIM(COALESCE(so.name, ''))) NOT IN ('not out', 'retired hurt', 'absent')`,
    ];

    const fixtureIds = [...new Set(groupRows.map((r) => r.fixture_id))];
    detailParams.push(fixtureIds);
    detailConditions.push(`fb.fixture_id = ANY($${detailParams.length}::bigint[])`);

    const batterIds = [...new Set(groupRows.map((r) => r.batter_id))];
    detailParams.push(batterIds);
    detailConditions.push(`fb.player_id = ANY($${detailParams.length}::bigint[])`);

    if (sameBowler) {
      const bowlerIds = [
        ...new Set(
          groupRows.map((r) => r.bowler_id).filter((id): id is string => id != null),
        ),
      ];
      detailParams.push(bowlerIds);
      detailConditions.push(
        `fb.bowling_player_id = ANY($${detailParams.length}::bigint[])`,
      );
    }

    const { rows: detailRows } = await this.db.query<{
      fixture_id: string;
      batter_id: string;
      bowler_id: string | null;
      scoreboard: string | null;
      outcome: string | null;
      runs_scored: number | null;
      balls_faced: number | null;
      bowler_name: string | null;
      batting_row_id: string;
    }>(
      `SELECT fb.fixture_id::text,
              fb.player_id::text AS batter_id,
              fb.bowling_player_id::text AS bowler_id,
              fb.scoreboard,
              so.name AS outcome,
              fb.runs_scored,
              fb.balls_faced,
              bowl.fullname AS bowler_name,
              fb.id::text AS batting_row_id
       FROM matches.fixture_batting fb
       JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
       LEFT JOIN master.players bowl ON bowl.sportmonks_id = fb.bowling_player_id
       WHERE ${detailConditions.join(' AND ')}
       ORDER BY fb.fixture_id, fb.scoreboard NULLS LAST, fb.sort_order NULLS LAST, fb.id`,
      detailParams,
    );

    const eventsByKey = new Map<string, MultiDismissalEventDto[]>();
    for (const d of detailRows) {
      const key = sameBowler
        ? `${d.fixture_id}|${d.batter_id}|${d.bowler_id ?? ''}`
        : `${d.fixture_id}|${d.batter_id}`;
      const list = eventsByKey.get(key) ?? [];
      list.push({
        scoreboard: d.scoreboard,
        outcome: d.outcome,
        runs: d.runs_scored,
        balls: d.balls_faced,
        bowlerId: d.bowler_id,
        bowlerName: d.bowler_name,
      });
      eventsByKey.set(key, list);
    }

    const rows: MultiDismissalRowDto[] = groupRows.map((g) => {
      const key = sameBowler
        ? `${g.fixture_id}|${g.batter_id}|${g.bowler_id ?? ''}`
        : `${g.fixture_id}|${g.batter_id}`;
      const dismissals = eventsByKey.get(key) ?? [];
      return {
        fixtureId: g.fixture_id,
        date: g.date_key,
        matchTitle:
          g.local_team && g.visitor_team
            ? `${g.local_team} vs ${g.visitor_team}`
            : null,
        batterId: g.batter_id,
        batterName: g.batter_name,
        batterImagePath: g.batter_image,
        bowlerId: g.bowler_id,
        bowlerName: g.bowler_name,
        dismissalCount: Number(g.dismissal_count),
        dismissals,
      };
    });

    return {
      scope,
      mode,
      minDismissals,
      sameBowler,
      batter: batterProfile
        ? {
            playerId: batterProfile.sportmonksId,
            name: batterProfile.name,
            imagePath: batterProfile.imagePath,
          }
        : null,
      bowler: bowlerProfile
        ? {
            playerId: bowlerProfile.sportmonksId,
            name: bowlerProfile.name,
            imagePath: bowlerProfile.imagePath,
          }
        : null,
      rows,
      note:
        'Derived from ingested scorecard batting rows (includes super overs / extra scoreboards when present). Coverage is partial — use fixtureId with get_match_scorecard for proof.',
    };
  }

  private async rankBatting(
    metric: RankingMetric,
    filters: { format?: string; leagueId?: number; seasonId?: number },
    teamId: string | undefined,
    window: RankingWindow,
    lastN: number,
    limit: number,
    minInnings: number,
  ): Promise<RankingRowDto[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['TRUE'];

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
    if (teamId) {
      params.push(teamId);
      conditions.push(`fb.team_id = $${params.length}::bigint`);
    }

    let withPrefix = '';
    if (window === 'last_n_matches') {
      params.push(lastN);
      const lastNParam = `$${params.length}`;
      withPrefix = `WITH recent_fixtures AS (
        SELECT fixture_id FROM (
          SELECT ff.fixture_id, MAX(ff.date_key) AS sa
          FROM gold.fact_fixture ff
          JOIN matches.fixture_batting fb ON fb.fixture_id = ff.fixture_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY ff.fixture_id
          ORDER BY sa DESC NULLS LAST
          LIMIT ${lastNParam}
        ) t
      ), `;
      conditions.push('ff.fixture_id IN (SELECT fixture_id FROM recent_fixtures)');
    } else {
      withPrefix = 'WITH ';
    }

    params.push(minInnings);
    const minParam = `$${params.length}`;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const orderBy =
      metric === 'average'
        ? `avg_runs DESC NULLS LAST`
        : metric === 'strike_rate'
          ? `strike_rate DESC NULLS LAST`
          : `runs DESC NULLS LAST`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      innings: string;
      runs: string;
      balls: string;
      strike_rate: string | null;
      avg_runs: string | null;
    }>(
      `${withPrefix}agg AS (
         SELECT fb.player_id,
                COUNT(*)::int AS innings,
                COALESCE(SUM(fb.runs_scored), 0)::int AS runs,
                COALESCE(SUM(fb.balls_faced), 0)::int AS balls,
                ROUND(
                  COALESCE(SUM(fb.runs_scored), 0)::numeric
                  / NULLIF(SUM(fb.balls_faced), 0) * 100,
                  2
                ) AS strike_rate,
                ROUND(
                  COALESCE(SUM(fb.runs_scored), 0)::numeric
                  / NULLIF(
                    COUNT(*) - COUNT(*) FILTER (
                      WHERE fb.wicket_outcome_id IS NULL
                         OR LOWER(COALESCE(so.name, '')) IN ('not out', 'retired hurt', 'absent')
                    ),
                    0
                  ),
                  2
                ) AS avg_runs
         FROM matches.fixture_batting fb
         JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
         LEFT JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY fb.player_id
         HAVING COUNT(*) >= ${minParam}
       )
       SELECT a.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              a.innings::text,
              a.runs::text,
              a.balls::text,
              a.strike_rate::text,
              a.avg_runs::text
       FROM agg a
       LEFT JOIN master.players p ON p.sportmonks_id = a.player_id
       ORDER BY ${orderBy}, a.innings DESC
       LIMIT ${limitParam}`,
      params,
    );

    return rows.map((row, i) => {
      const runs = Number(row.runs);
      const balls = Number(row.balls);
      const innings = Number(row.innings);
      const average = row.avg_runs != null ? Number(row.avg_runs) : null;
      const strikeRate = row.strike_rate != null ? Number(row.strike_rate) : null;
      const value =
        metric === 'average'
          ? average ?? 0
          : metric === 'strike_rate'
            ? strikeRate ?? 0
            : runs;
      return {
        rank: i + 1,
        playerId: row.player_id,
        playerName: row.player_name,
        imagePath: row.image_path,
        value,
        innings,
        runs,
        balls,
        average,
        strikeRate,
      };
    });
  }

  private async rankBowling(
    metric: RankingMetric,
    filters: { format?: string; leagueId?: number; seasonId?: number },
    teamId: string | undefined,
    window: RankingWindow,
    lastN: number,
    limit: number,
    minInnings: number,
  ): Promise<RankingRowDto[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['TRUE'];

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
    if (teamId) {
      params.push(teamId);
      conditions.push(`bowl.team_id = $${params.length}::bigint`);
    }

    let withPrefix = '';
    if (window === 'last_n_matches') {
      params.push(lastN);
      const lastNParam = `$${params.length}`;
      withPrefix = `WITH recent_fixtures AS (
        SELECT fixture_id FROM (
          SELECT ff.fixture_id, MAX(ff.date_key) AS sa
          FROM gold.fact_fixture ff
          JOIN matches.fixture_bowling bowl ON bowl.fixture_id = ff.fixture_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY ff.fixture_id
          ORDER BY sa DESC NULLS LAST
          LIMIT ${lastNParam}
        ) t
      ), `;
      conditions.push('ff.fixture_id IN (SELECT fixture_id FROM recent_fixtures)');
    } else {
      withPrefix = 'WITH ';
    }

    params.push(minInnings);
    const minParam = `$${params.length}`;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const orderBy =
      metric === 'economy'
        ? `economy ASC NULLS LAST`
        : `wickets DESC NULLS LAST, economy ASC NULLS LAST`;

    const { rows } = await this.db.query<{
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      innings: string;
      wickets: string;
      overs: string;
      runs_conceded: string;
      economy: string | null;
    }>(
      `${withPrefix}agg AS (
         SELECT bowl.player_id,
                COUNT(*)::int AS innings,
                COALESCE(SUM(bowl.wickets), 0)::int AS wickets,
                COALESCE(SUM(bowl.overs), 0)::numeric AS overs,
                COALESCE(SUM(bowl.runs_conceded), 0)::int AS runs_conceded,
                ROUND(
                  COALESCE(SUM(bowl.runs_conceded), 0)::numeric
                  / NULLIF(SUM(bowl.overs), 0),
                  2
                ) AS economy
         FROM matches.fixture_bowling bowl
         JOIN gold.fact_fixture ff ON ff.fixture_id = bowl.fixture_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY bowl.player_id
         HAVING COUNT(*) >= ${minParam}
       )
       SELECT a.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              a.innings::text,
              a.wickets::text,
              a.overs::text,
              a.runs_conceded::text,
              a.economy::text
       FROM agg a
       LEFT JOIN master.players p ON p.sportmonks_id = a.player_id
       ORDER BY ${orderBy}, a.innings DESC
       LIMIT ${limitParam}`,
      params,
    );

    return rows.map((row, i) => {
      const wickets = Number(row.wickets);
      const overs = Number(row.overs);
      const economy = row.economy != null ? Number(row.economy) : null;
      const value = metric === 'economy' ? economy ?? 99 : wickets;
      return {
        rank: i + 1,
        playerId: row.player_id,
        playerName: row.player_name,
        imagePath: row.image_path,
        value,
        innings: Number(row.innings),
        wickets,
        overs,
        economy,
      };
    });
  }

  private async battingPerformances(
    playerId: string,
    filters: { format?: string; leagueId?: number; seasonId?: number },
    teamId: string | undefined,
    sort: PerformanceSort,
    limit: number,
    vsBowlingType?: VsBowlingType,
  ): Promise<PerformanceRowDto[]> {
    const params: unknown[] = [playerId];
    const conditions = ['fb.player_id = $1::bigint'];

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
    if (teamId) {
      params.push(teamId);
      conditions.push(`fb.team_id = $${params.length}::bigint`);
    }
    if (vsBowlingType && vsBowlingType !== 'any') {
      conditions.push(`(${bowlerStyleMatchesSql(vsBowlingType)})`);
      conditions.push(`fb.wicket_outcome_id IS NOT NULL`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const orderBy =
      sort === 'recent'
        ? 'ff.date_key DESC NULLS LAST'
        : sort === 'worst'
          ? 'fb.runs_scored ASC NULLS LAST, fb.balls_faced DESC'
          : 'fb.runs_scored DESC NULLS LAST, fb.balls_faced ASC';

    const { rows } = await this.db.query<{
      fixture_id: string;
      date_key: string | null;
      local_team: string | null;
      visitor_team: string | null;
      team_id: string | null;
      localteam_id: string | null;
      runs: number | null;
      balls: number | null;
      fours: number | null;
      sixes: number | null;
      strike_rate: string | null;
      outcome: string | null;
      bowler_name: string | null;
      bowler_style: string | null;
    }>(
      `SELECT fb.fixture_id::text,
              ff.date_key::text,
              lt.name AS local_team,
              vt.name AS visitor_team,
              fb.team_id::text,
              ff.localteam_id::text,
              fb.runs_scored AS runs,
              fb.balls_faced AS balls,
              fb.fours,
              fb.sixes,
              fb.strike_rate::text,
              so.name AS outcome,
              bp.fullname AS bowler_name,
              bp.bowlingstyle AS bowler_style
       FROM matches.fixture_batting fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
       LEFT JOIN master.players bp ON bp.sportmonks_id = fb.bowling_player_id
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limitParam}`,
      params,
    );

    return rows.map((row) => {
      const opponent =
        row.team_id && row.localteam_id && row.team_id === row.localteam_id
          ? row.visitor_team
          : row.local_team;
      return {
        fixtureId: row.fixture_id,
        date: row.date_key,
        matchTitle:
          row.local_team && row.visitor_team
            ? `${row.local_team} vs ${row.visitor_team}`
            : null,
        opponent: opponent ?? null,
        runs: row.runs,
        balls: row.balls,
        fours: row.fours,
        sixes: row.sixes,
        strikeRate: row.strike_rate != null ? Number(row.strike_rate) : null,
        dismissalOutcome: row.outcome,
        bowlerName: row.bowler_name,
        bowlerStyle: row.bowler_style,
      };
    });
  }

  private async bowlingPerformances(
    playerId: string,
    filters: { format?: string; leagueId?: number; seasonId?: number },
    teamId: string | undefined,
    sort: PerformanceSort,
    limit: number,
  ): Promise<PerformanceRowDto[]> {
    const params: unknown[] = [playerId];
    const conditions = ['bowl.player_id = $1::bigint'];

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
    if (teamId) {
      params.push(teamId);
      conditions.push(`bowl.team_id = $${params.length}::bigint`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const orderBy =
      sort === 'recent'
        ? 'ff.date_key DESC NULLS LAST'
        : sort === 'worst'
          ? 'bowl.wickets ASC NULLS LAST, bowl.runs_conceded DESC'
          : 'bowl.wickets DESC NULLS LAST, bowl.runs_conceded ASC';

    const { rows } = await this.db.query<{
      fixture_id: string;
      date_key: string | null;
      local_team: string | null;
      visitor_team: string | null;
      team_id: string | null;
      localteam_id: string | null;
      overs: string | null;
      wickets: number | null;
      runs_conceded: number | null;
      economy: string | null;
    }>(
      `SELECT bowl.fixture_id::text,
              ff.date_key::text,
              lt.name AS local_team,
              vt.name AS visitor_team,
              bowl.team_id::text,
              ff.localteam_id::text,
              bowl.overs::text,
              bowl.wickets,
              bowl.runs_conceded,
              CASE
                WHEN bowl.overs > 0
                THEN ROUND(bowl.runs_conceded::numeric / bowl.overs, 2)
                ELSE NULL
              END::text AS economy
       FROM matches.fixture_bowling bowl
       JOIN gold.fact_fixture ff ON ff.fixture_id = bowl.fixture_id
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limitParam}`,
      params,
    );

    return rows.map((row) => {
      const opponent =
        row.team_id && row.localteam_id && row.team_id === row.localteam_id
          ? row.visitor_team
          : row.local_team;
      return {
        fixtureId: row.fixture_id,
        date: row.date_key,
        matchTitle:
          row.local_team && row.visitor_team
            ? `${row.local_team} vs ${row.visitor_team}`
            : null,
        opponent: opponent ?? null,
        overs: row.overs != null ? Number(row.overs) : null,
        wickets: row.wickets,
        runsConceded: row.runs_conceded,
        economy: row.economy != null ? Number(row.economy) : null,
      };
    });
  }

  private async ballStatsVs(
    playerId: string,
    vs: VsBowlingType,
    filters: { format?: string; leagueId?: number; seasonId?: number },
    teamId?: string,
  ): Promise<VsBowlingBallStatsDto> {
    const params: unknown[] = [playerId];
    const conditions = [`fb.batsman_striker_id = $1::bigint`];
    if (vs !== 'any') {
      conditions.push(`(${bowlerStyleMatchesSql(vs)})`);
    }
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
    // Optional: restrict to balls in fixtures where batter's team matches — via lineup or batting row
    if (teamId) {
      params.push(teamId);
      conditions.push(`EXISTS (
        SELECT 1 FROM matches.fixture_batting bat
        WHERE bat.fixture_id = fb.fixture_id
          AND bat.player_id = $1::bigint
          AND bat.team_id = $${params.length}::bigint
      )`);
    }

    const { rows } = await this.db.query<{
      balls: string;
      runs: string;
      wickets: string;
      fours: string;
      sixes: string;
    }>(
      `SELECT COUNT(*)::text AS balls,
              COALESCE(SUM(gf.runs_on_ball), 0)::text AS runs,
              COALESCE(SUM(CASE WHEN COALESCE(gf.is_wicket, false) THEN 1 ELSE 0 END), 0)::text AS wickets,
              COALESCE(SUM(CASE WHEN COALESCE(gf.is_four, false) THEN 1 ELSE 0 END), 0)::text AS fours,
              COALESCE(SUM(CASE WHEN COALESCE(gf.is_six, false) THEN 1 ELSE 0 END), 0)::text AS sixes
       FROM matches.fixture_balls fb
       JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
       LEFT JOIN gold.fact_ball gf ON gf.ball_id = fb.sportmonks_id
       LEFT JOIN master.players bp ON bp.sportmonks_id = fb.bowler_id
       WHERE ${conditions.join(' AND ')}`,
      params,
    );

    const ballsFaced = Number(rows[0]?.balls ?? 0);
    const runsScored = Number(rows[0]?.runs ?? 0);
    const available = ballsFaced > 0;
    return {
      available,
      ballsFaced,
      runsScored,
      wickets: Number(rows[0]?.wickets ?? 0),
      fours: Number(rows[0]?.fours ?? 0),
      sixes: Number(rows[0]?.sixes ?? 0),
      strikeRate:
        available && ballsFaced > 0
          ? Math.round((runsScored / ballsFaced) * 1000) / 10
          : null,
    };
  }

  private async resolvePlayer(
    q: string | undefined,
    playerId: string | undefined,
    leagueId?: number,
  ): Promise<{
    sportmonksId: string;
    name: string | null;
    imagePath: string | null;
  }> {
    if (playerId?.trim()) {
      const profile = await this.players.getById(playerId.trim());
      return {
        sportmonksId: profile.sportmonksId,
        name: profile.fullname ?? null,
        imagePath: profile.imagePath,
      };
    }
    if (!q?.trim()) {
      throw new BadRequestException('Provide q (player name) or playerId');
    }
    const [hit] = leagueId
      ? await this.players.search(q.trim(), 1, leagueId)
      : await this.players.search(q.trim(), 1);
    if (!hit) {
      throw new NotFoundException(`Player matching "${q}" not found`);
    }
    return {
      sportmonksId: hit.sportmonksId,
      name: hit.fullname ?? null,
      imagePath: hit.imagePath,
    };
  }

  private async resolveTeam(
    teamId?: number,
    teamName?: string,
  ): Promise<{ id: string; name: string | null } | null> {
    if (teamId != null) {
      const { rows } = await this.db.query<{
        sportmonks_id: string;
        name: string | null;
      }>(
        `SELECT sportmonks_id::text, name FROM master.teams WHERE sportmonks_id = $1::bigint`,
        [teamId],
      );
      if (!rows[0]) {
        throw new NotFoundException(`Team id ${teamId} not found`);
      }
      return { id: rows[0].sportmonks_id, name: rows[0].name };
    }
    if (teamName?.trim()) {
      const { rows } = await this.db.query<{
        sportmonks_id: string;
        name: string | null;
        national_team: boolean | null;
      }>(
        `SELECT sportmonks_id::text, name, national_team
         FROM master.teams
         WHERE is_active IS DISTINCT FROM false
           AND (name ILIKE $1 OR code ILIKE $1)
         ORDER BY
           CASE WHEN LOWER(name) = LOWER($2) THEN 0 ELSE 1 END,
           CASE WHEN national_team IS TRUE THEN 0 ELSE 1 END,
           name
         LIMIT 5`,
        [`%${teamName.trim()}%`, teamName.trim()],
      );
      if (!rows[0]) {
        throw new NotFoundException(`Team matching "${teamName}" not found`);
      }
      return { id: rows[0].sportmonks_id, name: rows[0].name };
    }
    return null;
  }

  private async buildScope(
    filters: { format?: string; leagueId?: number; seasonId?: number },
    team: { id: string; name: string | null } | null,
    extra: Partial<AnalyticsScopeDto> = {},
  ): Promise<AnalyticsScopeDto> {
    const base = await this.leagues.resolveScope(filters);
    return {
      ...base,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      ...extra,
    };
  }
}

function emptyBallStats(): VsBowlingBallStatsDto {
  return {
    available: false,
    ballsFaced: 0,
    runsScored: 0,
    wickets: 0,
    fours: 0,
    sixes: 0,
    strikeRate: null,
  };
}
