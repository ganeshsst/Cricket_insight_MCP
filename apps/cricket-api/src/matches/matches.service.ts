import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  MatchDetailDto,
  MatchInningScoreDto,
  MatchListQueryDto,
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

@Injectable()
export class MatchesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async list(query: MatchListQueryDto): Promise<MatchSummaryDto[]> {
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

    params.push(query.limit ?? 20);
    const limitParam = `$${params.length}`;
    params.push(query.offset ?? 0);
    const offsetParam = `$${params.length}`;

    const { rows } = await this.db.query<FixtureFactRow>(
      `SELECT ff.fixture_id::text,
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
              vt.name AS visitor_team_name
       FROM gold.fact_fixture ff
       LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
       LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ff.date_key DESC NULLS LAST, ff.fixture_id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    return rows.map((row) => this.toSummary(row));
  }

  async getById(fixtureId: string): Promise<MatchDetailDto> {
    const { rows } = await this.db.query<FixtureDetailRow>(
      `SELECT ff.fixture_id::text,
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
              ff.toss_won_team_id::text,
              ff.man_of_match_id::text,
              ff.elected,
              mf.note,
              lt.name AS local_team_name,
              vt.name AS visitor_team_name
       FROM gold.fact_fixture ff
       JOIN matches.fixtures mf ON mf.sportmonks_id = ff.fixture_id
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
      sort_order: number | null;
      runs_scored: number | null;
      balls_faced: number | null;
      fours: number | null;
      sixes: number | null;
      strike_rate: string | null;
      wicket_outcome: string | null;
      bowling_player_id: string | null;
      fow_score: number | null;
      fow_balls: string | null;
    }>(
      `SELECT fb.scoreboard,
              fb.team_id::text,
              t.name AS team_name,
              fb.player_id::text,
              p.fullname AS player_name,
              fb.sort_order,
              fb.runs_scored,
              fb.balls_faced,
              fb.fours,
              fb.sixes,
              fb.strike_rate::text,
              so.name AS wicket_outcome,
              fb.bowling_player_id::text,
              fb.fow_score,
              fb.fow_balls::text
       FROM matches.fixture_batting fb
       LEFT JOIN master.teams t ON t.sportmonks_id = fb.team_id
       LEFT JOIN master.players p ON p.sportmonks_id = fb.player_id
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
      is_captain: boolean | null;
      is_wicketkeeper: boolean | null;
      is_substitute: boolean | null;
    }>(
      `SELECT fl.team_id::text,
              t.name AS team_name,
              fl.player_id::text,
              p.fullname AS player_name,
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
        // Bowling team_id is the bowling side; prefer batting team when available.
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
          .filter((r) => (r.scoreboard ?? null) === meta.scoreboard)
          .map((r) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            teamId: r.team_id,
            sortOrder: r.sort_order,
            runs: r.runs_scored,
            balls: r.balls_faced,
            fours: r.fours,
            sixes: r.sixes,
            strikeRate: r.strike_rate != null ? Number(r.strike_rate) : null,
            wicketOutcome: r.wicket_outcome,
            bowlerId: r.bowling_player_id,
            fowScore: r.fow_score,
            fowBalls: r.fow_balls,
          }));

        const bowlingRows: ScorecardBowlingRowDto[] = bowling.rows
          .filter((r) => (r.scoreboard ?? null) === meta.scoreboard)
          .map((r) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            teamId: r.team_id,
            sortOrder: r.sort_order,
            overs: r.overs != null ? Number(r.overs) : null,
            maidens: r.maidens,
            runsConceded: r.runs_conceded,
            wickets: r.wickets,
            economy: r.economy_rate != null ? Number(r.economy_rate) : null,
          }));

        // Prefer batting side as the inning's batting team.
        const battingTeam = battingRows[0];
        return {
          scoreboard: meta.scoreboard,
          teamId: battingTeam?.teamId ?? meta.teamId,
          teamName: battingTeam
            ? batting.rows.find((r) => r.player_id === battingTeam.playerId)
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

    return rows.map((row) => ({
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
      isLive: Boolean(row.is_live),
    };
  }
}
