import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  MatchBallDto,
  MatchBallsDto,
  MatchBallsQueryDto,
  MatchCoverageDto,
  MatchDetailDto,
  MatchInningScoreDto,
  MatchListQueryDto,
  MatchOverDto,
  MatchOversDto,
  MatchPartnershipDto,
  MatchPartnershipsDto,
  MatchSearchQueryDto,
  MatchScorecardDto,
  MatchSummaryDto,
  ScorecardBattingRowDto,
  ScorecardBowlingRowDto,
  ScorecardInningDto,
  ScorecardLineupDto,
} from './dto/match.dto.js';

type FixtureFactRow = {
  fixture_id: string;
  date_key: string | null;
  match_format: string | null;
  status: string | null;
  league_id: string | null;
  season_id: string | null;
  localteam_id: string | null;
  visitorteam_id: string | null;
  winner_team_id: string | null;
  venue_id: string | null;
  is_live: boolean | null;
  local_team_name: string | null;
  visitor_team_name: string | null;
};

type FixtureDetailRow = FixtureFactRow & {
  toss_won_team_id: string | null;
  man_of_match_id: string | null;
  elected: string | null;
  note: string | null;
};

const FIXTURE_SELECT = `ff.fixture_id::text,
              ff.date_key::text,
              ff.match_format,
              ff.status,
              ff.league_id::text,
              ff.season_id::text,
              ff.localteam_id::text,
              ff.visitorteam_id::text,
              ff.winner_team_id::text,
              ff.venue_id::text,
              ff.is_live,
              lt.name AS local_team_name,
              vt.name AS visitor_team_name`;

@Injectable()
export class MatchesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async list(query: MatchListQueryDto): Promise<MatchSummaryDto[]> {
    const { conditions, params, limitParam, offsetParam } =
      this.buildListFilters(query);

    const { rows } = await this.db.query<FixtureFactRow>(
      `SELECT ${FIXTURE_SELECT}
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    return rows.map((row: FixtureFactRow) => this.toSummary(row));
  }

  async search(query: MatchSearchQueryDto): Promise<MatchSummaryDto[]> {
    if (query.type?.toLowerCase() === 'final') {
      return [await this.getSeasonFinal(query)];
    }

    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (query.leagueId) {
      params.push(query.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }
    if (query.seasonId) {
      params.push(query.seasonId);
      conditions.push(`ff.season_id = $${params.length}::bigint`);
    }
    if (query.format) {
      params.push(query.format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`LOWER(ff.status) = LOWER($${params.length})`);
    }
    if (query.teamAId && query.teamBId) {
      params.push(query.teamAId, query.teamBId);
      const teamAParam = `$${params.length - 1}`;
      const teamBParam = `$${params.length}`;
      conditions.push(
        `((ff.localteam_id = ${teamAParam}::bigint AND ff.visitorteam_id = ${teamBParam}::bigint)
          OR (ff.localteam_id = ${teamBParam}::bigint AND ff.visitorteam_id = ${teamAParam}::bigint))`,
      );
    } else if (query.teamId ?? query.teamAId) {
      params.push(query.teamId ?? query.teamAId);
      conditions.push(
        `(ff.localteam_id = $${params.length}::bigint OR ff.visitorteam_id = $${params.length}::bigint)`,
      );
    }

    params.push(query.limit ?? 20);
    const limitParam = `$${params.length}`;
    params.push(query.offset ?? 0);
    const offsetParam = `$${params.length}`;

    const { rows } = await this.db.query<FixtureFactRow>(
      `SELECT ${FIXTURE_SELECT}
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    return rows.map((row: FixtureFactRow) => this.toSummary(row));
  }

  async getSeasonFinal(query: MatchSearchQueryDto): Promise<MatchSummaryDto> {
    if (!query.leagueId || !query.seasonId) {
      throw new BadRequestException('leagueId and seasonId are required to infer a final');
    }

    const results = await this.list({
      leagueId: query.leagueId,
      seasonId: query.seasonId,
      format: query.format,
      status: 'Finished',
      limit: 1,
      offset: 0,
    });
    const final = results[0];
    if (!final) {
      throw new NotFoundException(`Final not found for season ${query.seasonId}`);
    }
    return { ...final, inferredFinal: true };
  }

  async getById(fixtureId: string): Promise<MatchDetailDto> {
    if (!/^\d+$/.test(fixtureId.trim())) {
      throw new BadRequestException(
        `fixtureId must be a numeric SportMonks id, got "${fixtureId}". Use search_matches, list_matches, or get_season_final first — never placeholders like "(latest_match_fixture_id)".`,
      );
    }

    const { rows } = await this.db.query<FixtureDetailRow>(
      `SELECT ${FIXTURE_SELECT},
              ff.toss_won_team_id::text,
              ff.man_of_match_id::text,
              ff.elected,
              mf.note
       FROM gold.fact_fixture ff
       LEFT JOIN matches.fixtures mf ON mf.sportmonks_id = ff.fixture_id
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ff.fixture_id = $1::bigint`,
      [fixtureId],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Match ${fixtureId} not found`);
    }

    const innings = await this.getInnings(fixtureId);
    return {
      ...this.toSummary(row),
      tossWonTeamId: row.toss_won_team_id,
      manOfMatchId: row.man_of_match_id,
      elected: row.elected,
      note: row.note,
      innings,
    };
  }

  async getScorecard(fixtureId: string): Promise<MatchScorecardDto> {
    const fixture = await this.getById(fixtureId);

    const batting = await this.db.query<{
      scoreboard: string | null;
      team_id: string;
      team_name: string | null;
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      sort_order: number | null;
      runs_scored: number | null;
      balls_faced: number | null;
      fours: number | null;
      sixes: number | null;
      strike_rate: string | null;
      wicket_outcome: string | null;
      bowling_player_id: string | null;
      bowling_player_name: string | null;
      catch_stump_player_id: string | null;
      catch_stump_player_name: string | null;
      runout_by_player_id: string | null;
      runout_by_player_name: string | null;
      fow_score: number | null;
      fow_balls: string | null;
    }>(
      `SELECT fb.scoreboard,
              fb.team_id::text,
              t.name AS team_name,
              fb.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              fb.sort_order,
              fb.runs_scored,
              fb.balls_faced,
              fb.fours,
              fb.sixes,
              fb.strike_rate::text,
              so.name AS wicket_outcome,
              fb.bowling_player_id::text,
              bp.fullname AS bowling_player_name,
              fb.catch_stump_player_id::text,
              cp.fullname AS catch_stump_player_name,
              fb.runout_by_player_id::text,
              rp.fullname AS runout_by_player_name,
              fb.fow_score,
              fb.fow_balls::text
       FROM matches.fixture_batting fb
       LEFT JOIN master.teams t ON t.sportmonks_id = fb.team_id
       LEFT JOIN master.players p ON p.sportmonks_id = fb.player_id
       LEFT JOIN master.players bp ON bp.sportmonks_id = fb.bowling_player_id
       LEFT JOIN master.players cp ON cp.sportmonks_id = fb.catch_stump_player_id
       LEFT JOIN master.players rp ON rp.sportmonks_id = fb.runout_by_player_id
       LEFT JOIN master.score_outcomes so ON so.sportmonks_id = fb.wicket_outcome_id
       WHERE fb.fixture_id = $1::bigint
       ORDER BY fb.scoreboard NULLS LAST, fb.sort_order NULLS LAST, fb.id`,
      [fixtureId],
    );

    const bowling = await this.db.query<{
      scoreboard: string | null;
      team_id: string;
      team_name: string | null;
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      sort_order: number | null;
      overs: string | null;
      maidens: number | null;
      runs_conceded: number | null;
      wickets: number | null;
      economy_rate: string | null;
    }>(
      `SELECT fb.scoreboard,
              fb.team_id::text,
              t.name AS team_name,
              fb.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              fb.sort_order,
              fb.overs::text,
              fb.maidens,
              fb.runs_conceded,
              fb.wickets,
              fb.economy_rate::text
       FROM matches.fixture_bowling fb
       LEFT JOIN master.teams t ON t.sportmonks_id = fb.team_id
       LEFT JOIN master.players p ON p.sportmonks_id = fb.player_id
       WHERE fb.fixture_id = $1::bigint
       ORDER BY fb.scoreboard NULLS LAST, fb.sort_order NULLS LAST, fb.id`,
      [fixtureId],
    );

    const lineupsRaw = await this.db.query<{
      team_id: string;
      team_name: string | null;
      player_id: string;
      player_name: string | null;
      image_path: string | null;
      is_captain: boolean | null;
      is_wicketkeeper: boolean | null;
      is_substitute: boolean | null;
    }>(
      `SELECT fl.team_id::text,
              t.name AS team_name,
              fl.player_id::text,
              p.fullname AS player_name,
              p.image_path,
              fl.is_captain,
              fl.is_wicketkeeper,
              fl.is_substitute
       FROM matches.fixture_lineups fl
       LEFT JOIN master.teams t ON t.sportmonks_id = fl.team_id
       LEFT JOIN master.players p ON p.sportmonks_id = fl.player_id
       WHERE fl.fixture_id = $1::bigint
       ORDER BY fl.team_id, fl.is_substitute NULLS FIRST, p.fullname NULLS LAST`,
      [fixtureId],
    );

    const inningKeys = new Map<
      string,
      { scoreboard: string | null; teamId: string; teamName: string | null }
    >();

    for (const row of batting.rows) {
      const key = row.scoreboard ?? '__null__';
      if (!inningKeys.has(key)) {
        inningKeys.set(key, {
          scoreboard: row.scoreboard,
          teamId: row.team_id,
          teamName: row.team_name,
        });
      }
    }
    for (const row of bowling.rows) {
      const key = row.scoreboard ?? '__null__';
      if (!inningKeys.has(key)) {
        inningKeys.set(key, {
          scoreboard: row.scoreboard,
          teamId: row.team_id,
          teamName: row.team_name,
        });
      }
    }

    const innings: ScorecardInningDto[] = [...inningKeys.values()]
      .sort((a, b) => (a.scoreboard ?? '').localeCompare(b.scoreboard ?? ''))
      .map((meta) => {
        const battingRows: ScorecardBattingRowDto[] = batting.rows
          .filter((r: (typeof batting.rows)[number]) => (r.scoreboard ?? null) === meta.scoreboard)
          .map((r: (typeof batting.rows)[number]) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            imagePath: r.image_path,
            teamId: r.team_id,
            sortOrder: r.sort_order,
            runs: r.runs_scored,
            balls: r.balls_faced,
            fours: r.fours,
            sixes: r.sixes,
            strikeRate: r.strike_rate != null ? Number(r.strike_rate) : null,
            wicketOutcome: r.wicket_outcome,
            bowlerId: r.bowling_player_id,
            bowlerName: r.bowling_player_name,
            catchStumpPlayerId: r.catch_stump_player_id,
            catchStumpPlayerName: r.catch_stump_player_name,
            runoutByPlayerId: r.runout_by_player_id,
            runoutByPlayerName: r.runout_by_player_name,
            fowScore: r.fow_score,
            fowBalls: r.fow_balls,
          }));

        const bowlingRows: ScorecardBowlingRowDto[] = bowling.rows
          .filter((r: (typeof bowling.rows)[number]) => (r.scoreboard ?? null) === meta.scoreboard)
          .map((r: (typeof bowling.rows)[number]) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            imagePath: r.image_path,
            teamId: r.team_id,
            sortOrder: r.sort_order,
            overs: r.overs != null ? Number(r.overs) : null,
            maidens: r.maidens,
            runsConceded: r.runs_conceded,
            wickets: r.wickets,
            economy: r.economy_rate != null ? Number(r.economy_rate) : null,
          }));

        const battingTeam = battingRows[0];
        return {
          scoreboard: meta.scoreboard,
          teamId: battingTeam?.teamId ?? meta.teamId,
          teamName: battingTeam
            ? batting.rows.find((r: (typeof batting.rows)[number]) => r.player_id === battingTeam.playerId)
                ?.team_name ?? meta.teamName
            : meta.teamName,
          batting: battingRows,
          bowling: bowlingRows,
        };
      });

    const lineupByTeam = new Map<string, ScorecardLineupDto>();
    for (const row of lineupsRaw.rows) {
      let lineup = lineupByTeam.get(row.team_id);
      if (!lineup) {
        lineup = {
          teamId: row.team_id,
          teamName: row.team_name,
          players: [],
        };
        lineupByTeam.set(row.team_id, lineup);
      }
      lineup.players.push({
        playerId: row.player_id,
        playerName: row.player_name,
        imagePath: row.image_path,
        isCaptain: Boolean(row.is_captain),
        isWicketkeeper: Boolean(row.is_wicketkeeper),
        isSubstitute: Boolean(row.is_substitute),
      });
    }

    return {
      fixture,
      innings,
      lineups: [...lineupByTeam.values()],
    };
  }

  async getCoverage(fixtureId: string): Promise<MatchCoverageDto> {
    await this.getById(fixtureId);

    const { rows } = await this.db.query<{
      innings_total_rows: string;
      batting_rows: string;
      bowling_rows: string;
      lineup_rows: string;
      ball_rows: string;
      over_rows: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM matches.fixture_runs WHERE fixture_id = $1::bigint)::text AS innings_total_rows,
         (SELECT COUNT(*) FROM matches.fixture_batting WHERE fixture_id = $1::bigint)::text AS batting_rows,
         (SELECT COUNT(*) FROM matches.fixture_bowling WHERE fixture_id = $1::bigint)::text AS bowling_rows,
         (SELECT COUNT(*) FROM matches.fixture_lineups WHERE fixture_id = $1::bigint)::text AS lineup_rows,
         (SELECT COUNT(*) FROM matches.fixture_balls WHERE fixture_id = $1::bigint)::text AS ball_rows,
         (SELECT COUNT(*) FROM matches.fixture_inning_overs WHERE fixture_id = $1::bigint)::text AS over_rows`,
      [fixtureId],
    );

    const row = rows[0];
    const inningsTotalRows = Number(row?.innings_total_rows ?? 0);
    const battingRows = Number(row?.batting_rows ?? 0);
    const bowlingRows = Number(row?.bowling_rows ?? 0);
    const lineupRows = Number(row?.lineup_rows ?? 0);
    const ballRows = Number(row?.ball_rows ?? 0);
    const overRows = Number(row?.over_rows ?? 0);

    return {
      fixtureId,
      hasInningsTotals: inningsTotalRows > 0,
      hasBatting: battingRows > 0,
      hasBowling: bowlingRows > 0,
      hasLineups: lineupRows > 0,
      hasBalls: ballRows > 0,
      hasOvers: overRows > 0,
      inningsTotalRows,
      battingRows,
      bowlingRows,
      lineupRows,
      ballRows,
      overRows,
      note:
        battingRows === 0 || bowlingRows === 0 || lineupRows === 0
          ? 'Scorecard data is partially loaded for this fixture.'
          : ballRows === 0
            ? 'Ball-by-ball / over data is not loaded for this fixture.'
            : undefined,
    };
  }

  async getOvers(fixtureId: string): Promise<MatchOversDto> {
    await this.getById(fixtureId);

    const { rows } = await this.db.query<{
      scoreboard: string | null;
      team_id: string;
      team_name: string | null;
      over_number: number;
      runs_in_over: number;
      wickets_in_over: number;
      bowler_id: string | null;
      bowler_name: string | null;
    }>(
      `SELECT fio.scoreboard,
              fio.team_id::text,
              t.name AS team_name,
              fio.over_number,
              fio.runs_in_over,
              fio.wickets_in_over,
              fio.bowler_id::text,
              p.fullname AS bowler_name
       FROM matches.fixture_inning_overs fio
       LEFT JOIN master.teams t ON t.sportmonks_id = fio.team_id
       LEFT JOIN master.players p ON p.sportmonks_id = fio.bowler_id
       WHERE fio.fixture_id = $1::bigint
       ORDER BY fio.scoreboard NULLS LAST, fio.over_number ASC`,
      [fixtureId],
    );

    const overs: MatchOverDto[] = rows.map((r) => ({
      scoreboard: r.scoreboard,
      teamId: r.team_id,
      teamName: r.team_name,
      overNumber: r.over_number,
      runsInOver: r.runs_in_over,
      wicketsInOver: r.wickets_in_over,
      bowlerId: r.bowler_id,
      bowlerName: r.bowler_name,
    }));

    return { fixtureId, overs };
  }

  async getPartnerships(fixtureId: string): Promise<MatchPartnershipsDto> {
    await this.getById(fixtureId);

    const { rows } = await this.db.query<{
      scoreboard: string | null;
      team_id: string | null;
      team_name: string | null;
      ball_number: string;
      batsman_striker_id: string | null;
      batsman_non_striker_id: string | null;
      striker_name: string | null;
      non_striker_name: string | null;
      runs_on_ball: number | null;
      is_wicket: boolean | null;
    }>(
      `SELECT fb.scoreboard,
              fb.team_id::text,
              t.name AS team_name,
              fb.ball_number::text,
              fb.batsman_striker_id::text,
              fb.batsman_non_striker_id::text,
              ps.fullname AS striker_name,
              pns.fullname AS non_striker_name,
              gf.runs_on_ball,
              gf.is_wicket
       FROM matches.fixture_balls fb
       LEFT JOIN gold.fact_ball gf ON gf.ball_id = fb.sportmonks_id
       LEFT JOIN master.teams t ON t.sportmonks_id = fb.team_id
       LEFT JOIN master.players ps ON ps.sportmonks_id = fb.batsman_striker_id
       LEFT JOIN master.players pns ON pns.sportmonks_id = fb.batsman_non_striker_id
       WHERE fb.fixture_id = $1::bigint
         AND fb.batsman_striker_id IS NOT NULL
         AND fb.batsman_non_striker_id IS NOT NULL
       ORDER BY fb.scoreboard NULLS LAST, fb.ball_number ASC, fb.id ASC`,
      [fixtureId],
    );

    if (rows.length === 0) {
      return {
        fixtureId,
        partnerships: [],
        note: 'No ball-by-ball rows available to derive partnerships for this fixture.',
      };
    }

    const partnerships: MatchPartnershipDto[] = [];
    type Acc = {
      scoreboard: string | null;
      teamId: string | null;
      teamName: string | null;
      p1: string;
      p2: string;
      p1Name: string | null;
      p2Name: string | null;
      runs: number;
      balls: number;
      startBall: string | null;
      endBall: string | null;
      wicketNumber: number;
    };

    let current: Acc | null = null;
    let wicketByBoard = new Map<string, number>();

    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    for (const row of rows) {
      const s = row.batsman_striker_id!;
      const ns = row.batsman_non_striker_id!;
      const board = row.scoreboard ?? '__null__';
      const key = pairKey(s, ns);
      const currentKey = current
        ? `${current.scoreboard ?? '__null__'}|${pairKey(current.p1, current.p2)}`
        : null;
      const nextKey = `${board}|${key}`;

      if (!current || currentKey !== nextKey) {
        if (current) {
          partnerships.push(this.toPartnershipDto(current));
        }
        const wicketNumber = (wicketByBoard.get(board) ?? 0) + 1;
        wicketByBoard.set(board, wicketNumber);
        current = {
          scoreboard: row.scoreboard,
          teamId: row.team_id,
          teamName: row.team_name,
          p1: s,
          p2: ns,
          p1Name: row.striker_name,
          p2Name: row.non_striker_name,
          runs: 0,
          balls: 0,
          startBall: row.ball_number,
          endBall: row.ball_number,
          wicketNumber,
        };
      }

      current!.runs += row.runs_on_ball ?? 0;
      current!.balls += 1;
      current!.endBall = row.ball_number;
      // Prefer names when present on later balls
      if (row.striker_name && current!.p1 === s) current!.p1Name = row.striker_name;
      if (row.non_striker_name && current!.p2 === ns) current!.p2Name = row.non_striker_name;
      if (row.striker_name && current!.p1 === ns) current!.p1Name = row.striker_name;
      if (row.non_striker_name && current!.p2 === s) current!.p2Name = row.non_striker_name;

      if (row.is_wicket) {
        partnerships.push(this.toPartnershipDto(current!));
        current = null;
      }
    }

    if (current) {
      partnerships.push(this.toPartnershipDto(current));
    }

    return { fixtureId, partnerships };
  }

  async getBalls(fixtureId: string, query: MatchBallsQueryDto): Promise<MatchBallsDto> {
    await this.getById(fixtureId);

    const limit = query.limit ?? 120;
    const offset = query.offset ?? 0;
    const params: unknown[] = [fixtureId];
    const conditions = ['fb.fixture_id = $1::bigint'];

    if (query.scoreboard) {
      params.push(query.scoreboard);
      conditions.push(`fb.scoreboard = $${params.length}`);
    }

    const countResult = await this.db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM matches.fixture_balls fb
       WHERE ${conditions.join(' AND ')}`,
      params,
    );
    const totalAvailable = Number(countResult.rows[0]?.n ?? 0);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const { rows } = await this.db.query<{
      scoreboard: string | null;
      team_id: string | null;
      team_name: string | null;
      ball_number: string;
      batsman_striker_id: string | null;
      striker_name: string | null;
      batsman_non_striker_id: string | null;
      non_striker_name: string | null;
      bowler_id: string | null;
      bowler_name: string | null;
      runs_on_ball: number | null;
      is_wicket: boolean | null;
      is_four: boolean | null;
      is_six: boolean | null;
      outcome: string | null;
      batsman_out_id: string | null;
    }>(
      `SELECT fb.scoreboard,
              fb.team_id::text,
              t.name AS team_name,
              fb.ball_number::text,
              fb.batsman_striker_id::text,
              ps.fullname AS striker_name,
              fb.batsman_non_striker_id::text,
              pns.fullname AS non_striker_name,
              fb.bowler_id::text,
              pb.fullname AS bowler_name,
              gf.runs_on_ball,
              COALESCE(gf.is_wicket, false) AS is_wicket,
              COALESCE(gf.is_four, false) AS is_four,
              COALESCE(gf.is_six, false) AS is_six,
              so.name AS outcome,
              fb.batsman_out_id::text
       FROM matches.fixture_balls fb
       LEFT JOIN gold.fact_ball gf ON gf.ball_id = fb.sportmonks_id
       LEFT JOIN master.teams t ON t.sportmonks_id = fb.team_id
       LEFT JOIN master.players ps ON ps.sportmonks_id = fb.batsman_striker_id
       LEFT JOIN master.players pns ON pns.sportmonks_id = fb.batsman_non_striker_id
       LEFT JOIN master.players pb ON pb.sportmonks_id = fb.bowler_id
       LEFT JOIN master.score_outcomes so ON so.sportmonks_id = fb.score_outcome_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY fb.scoreboard NULLS LAST, fb.ball_number ASC, fb.id ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    const balls: MatchBallDto[] = rows.map((r) => ({
      scoreboard: r.scoreboard,
      teamId: r.team_id,
      teamName: r.team_name,
      ballNumber: r.ball_number,
      batsmanStrikerId: r.batsman_striker_id,
      batsmanStrikerName: r.striker_name,
      batsmanNonStrikerId: r.batsman_non_striker_id,
      batsmanNonStrikerName: r.non_striker_name,
      bowlerId: r.bowler_id,
      bowlerName: r.bowler_name,
      runsOnBall: r.runs_on_ball,
      isWicket: Boolean(r.is_wicket),
      isFour: Boolean(r.is_four),
      isSix: Boolean(r.is_six),
      outcome: r.outcome,
      batsmanOutId: r.batsman_out_id,
    }));

    return {
      fixtureId,
      balls,
      totalAvailable,
      limit,
      offset,
      note:
        totalAvailable === 0
          ? 'No ball-by-ball data for this fixture.'
          : totalAvailable > limit
            ? `Returning ${balls.length} of ${totalAvailable} balls. Increase limit or paginate with offset.`
            : undefined,
    };
  }

  private toPartnershipDto(acc: {
    scoreboard: string | null;
    teamId: string | null;
    teamName: string | null;
    p1: string;
    p2: string;
    p1Name: string | null;
    p2Name: string | null;
    runs: number;
    balls: number;
    startBall: string | null;
    endBall: string | null;
    wicketNumber: number;
  }): MatchPartnershipDto {
    return {
      scoreboard: acc.scoreboard,
      teamId: acc.teamId,
      teamName: acc.teamName,
      wicketNumber: acc.wicketNumber,
      player1Id: acc.p1,
      player1Name: acc.p1Name,
      player2Id: acc.p2,
      player2Name: acc.p2Name,
      runs: acc.runs,
      balls: acc.balls,
      startBall: acc.startBall,
      endBall: acc.endBall,
    };
  }

  private buildListFilters(query: MatchListQueryDto): {
    conditions: string[];
    params: unknown[];
    limitParam: string;
    offsetParam: string;
  } {
    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (query.leagueId) {
      params.push(query.leagueId);
      conditions.push(`ff.league_id = $${params.length}::bigint`);
    }
    if (query.seasonId) {
      params.push(query.seasonId);
      conditions.push(`ff.season_id = $${params.length}::bigint`);
    }
    if (query.teamId) {
      params.push(query.teamId);
      conditions.push(
        `(ff.localteam_id = $${params.length}::bigint OR ff.visitorteam_id = $${params.length}::bigint)`,
      );
    }
    if (query.format) {
      params.push(query.format);
      conditions.push(`ff.match_format = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`LOWER(ff.status) = LOWER($${params.length})`);
    }

    params.push(query.limit ?? 20);
    const limitParam = `$${params.length}`;
    params.push(query.offset ?? 0);
    const offsetParam = `$${params.length}`;

    return { conditions, params, limitParam, offsetParam };
  }

  private async getInnings(fixtureId: string): Promise<MatchInningScoreDto[]> {
    const { rows } = await this.db.query<{
      team_id: string;
      team_name: string | null;
      inning: number;
      score: number | null;
      wickets: number | null;
      overs: string | null;
    }>(
      `SELECT fr.team_id::text,
              t.name AS team_name,
              fr.inning,
              fr.score,
              fr.wickets,
              fr.overs::text
       FROM matches.fixture_runs fr
       LEFT JOIN master.teams t ON t.sportmonks_id = fr.team_id
       WHERE fr.fixture_id = $1::bigint
       ORDER BY fr.inning`,
      [fixtureId],
    );

    return rows.map((row: (typeof rows)[number]) => ({
      teamId: row.team_id,
      teamName: row.team_name,
      inning: row.inning,
      score: row.score,
      wickets: row.wickets,
      overs: row.overs ? Number(row.overs) : null,
    }));
  }

  private toSummary(row: FixtureFactRow): MatchSummaryDto {
    return {
      fixtureId: row.fixture_id,
      date: row.date_key,
      format: row.match_format,
      status: row.status,
      leagueId: row.league_id,
      seasonId: row.season_id,
      localTeamId: row.localteam_id,
      visitorTeamId: row.visitorteam_id,
      localTeamName: row.local_team_name,
      visitorTeamName: row.visitor_team_name,
      winnerTeamId: row.winner_team_id,
      venueId: row.venue_id,
      // gold.fact_fixture.is_live is unreliable (many Finished rows flagged true).
      isLive: (row.status ?? '').toLowerCase() === 'live',
    };
  }
}
