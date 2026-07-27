import type { CricInsightsResponse, UIComponent } from '@/types/generative-ui';
import { asRecord, resolvePlayerPhoto } from '@/lib/cricinsights/utils';
import { sanitizeUi } from '@/lib/cricinsights/ai/hydrate';

type ToolHit = { toolName: string; output: unknown };

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function shortName(full: string | null | undefined): string {
  if (!full?.trim()) return '';
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}

/** Build cricket how-out string from scorecard batting row fields. */
export function formatDismissal(row: Record<string, unknown>): string {
  const outcome = String(row.wicketOutcome ?? row.wicket_outcome ?? '').trim();
  const lower = outcome.toLowerCase();
  const bowler = shortName(
    (row.bowlerName as string) || (row.bowling_player_name as string) || '',
  );
  const fielder = shortName(
    (row.catchStumpPlayerName as string) ||
      (row.catch_stump_player_name as string) ||
      '',
  );
  const runout = shortName(
    (row.runoutByPlayerName as string) ||
      (row.runout_by_player_name as string) ||
      '',
  );

  if (!outcome || lower.includes('not out') || lower === 'no wicket') {
    return 'not out';
  }
  if (lower.includes('retired')) return outcome;
  if (lower.includes('run out') || lower.includes('runout')) {
    return runout ? `run out (${runout})` : 'run out';
  }
  if (lower.includes('stump')) {
    if (fielder && bowler) return `st ${fielder} b ${bowler}`;
    if (bowler) return `st b ${bowler}`;
    return outcome;
  }
  if (lower.includes('catch') || lower.includes('caught')) {
    if (fielder && bowler) {
      if (fielder.toLowerCase() === bowler.toLowerCase()) {
        return `c & b ${bowler}`;
      }
      return `c ${fielder} b ${bowler}`;
    }
    if (bowler) return `c b ${bowler}`;
    return outcome;
  }
  if (lower.includes('lbw')) {
    return bowler ? `lbw b ${bowler}` : 'lbw';
  }
  if (lower.includes('bowled')) {
    return bowler ? `b ${bowler}` : 'bowled';
  }
  if (bowler) return `${outcome} b ${bowler}`;
  return outcome;
}

function isPlayerStatsBundle(out: unknown): out is {
  profile?: Record<string, unknown>;
  batting?: Record<string, unknown>;
  bowling?: Record<string, unknown>;
} {
  const o = asRecord(out);
  return Boolean(o.profile || o.batting);
}

function widgetsFromPlayerStats(out: unknown): UIComponent[] {
  if (!isPlayerStatsBundle(out)) return [];
  const profile = asRecord(out.profile);
  const batting = asRecord(out.batting);
  const bowling = asRecord(out.bowling);

  const name =
    (typeof profile.fullname === 'string' && profile.fullname) ||
    (typeof profile.name === 'string' && profile.name) ||
    'Player';
  const imageUrl = resolvePlayerPhoto(
    typeof profile.imagePath === 'string'
      ? profile.imagePath
      : typeof profile.imageUrl === 'string'
        ? profile.imageUrl
        : null,
    name,
  );

  const rows: [string, string][] = [];
  if (batting.innings != null) rows.push(['Innings', fmt(Number(batting.innings))]);
  if (batting.runs != null) rows.push(['Runs', fmt(Number(batting.runs))]);
  if (batting.average != null) rows.push(['Average', fmt(Number(batting.average))]);
  if (batting.strikeRate != null)
    rows.push(['Strike Rate', fmt(Number(batting.strikeRate))]);
  if (batting.fours != null) rows.push(['Fours', fmt(Number(batting.fours))]);
  if (batting.sixes != null) rows.push(['Sixes', fmt(Number(batting.sixes))]);

  if (bowling.wickets != null && Number(bowling.wickets) > 0) {
    if (bowling.overs != null) rows.push(['Overs', fmt(Number(bowling.overs))]);
    rows.push(['Wickets', fmt(Number(bowling.wickets))]);
    if (bowling.average != null)
      rows.push(['Bowling Avg', fmt(Number(bowling.average))]);
    if (bowling.economy != null)
      rows.push(['Economy', fmt(Number(bowling.economy))]);
  }

  const widgets: UIComponent[] = [
    {
      type: 'player_hero',
      player: { name, imageUrl },
    },
  ];

  if (rows.length) {
    widgets.push({
      type: 'stats_table',
      headers: ['Metric', 'Value'],
      rows,
    });
  }

  return widgets;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function metricWinner(
  metric: string,
  a: number | null,
  b: number | null,
): 'a' | 'b' | 'tie' | 'none' {
  if (a == null || b == null) return 'none';
  const lowerBetter = /economy|bowling avg|bowl avg|conceded/i.test(metric);
  if (a === b) return 'tie';
  if (lowerBetter) return a < b ? 'a' : 'b';
  return a > b ? 'a' : 'b';
}

type ComparePlayerView = {
  name: string;
  imageUrl: string | null;
  role: 'batter' | 'bowler' | 'allrounder';
  batting: Record<string, number>;
  bowling: Record<string, number>;
};

function inferCompareRole(
  batting: Record<string, unknown>,
  bowling: Record<string, unknown>,
): 'batter' | 'bowler' | 'allrounder' {
  const runs = numOrNull(batting.runs) ?? 0;
  const batInns = numOrNull(batting.innings) ?? 0;
  const wickets = numOrNull(bowling.wickets) ?? 0;
  const bowlInns = numOrNull(bowling.innings) ?? 0;
  const batScore = runs + batInns * 10;
  const bowlScore = wickets * 40 + bowlInns * 8;
  const hasBat = batScore > 0;
  const hasBowl = wickets > 0 || bowlInns > 2;
  if (hasBat && hasBowl && bowlScore >= batScore * 0.35 && batScore >= bowlScore * 0.35) {
    return 'allrounder';
  }
  if (bowlScore > batScore * 1.2 && hasBowl) return 'bowler';
  if (hasBat) return 'batter';
  if (hasBowl) return 'bowler';
  return 'batter';
}

function roleLabel(role: ComparePlayerView['role']): string {
  if (role === 'bowler') return 'Bowler';
  if (role === 'allrounder') return 'All-rounder';
  return 'Batter';
}

function battingStatsMap(batting: Record<string, unknown>): Record<string, number> {
  const stats: Record<string, number> = {};
  const inns = numOrNull(batting.innings);
  const runs = numOrNull(batting.runs);
  const avg = numOrNull(batting.average);
  const sr = numOrNull(batting.strikeRate);
  const balls = numOrNull(batting.balls);
  const fours = numOrNull(batting.fours);
  const sixes = numOrNull(batting.sixes);
  if (inns != null) stats.Innings = inns;
  if (runs != null) stats.Runs = runs;
  if (balls != null) stats['Balls Faced'] = balls;
  if (avg != null) stats.Average = avg;
  if (sr != null) stats['Strike Rate'] = sr;
  if (fours != null) stats.Fours = fours;
  if (sixes != null) stats.Sixes = sixes;
  return stats;
}

function bowlingStatsMap(bowling: Record<string, unknown>): Record<string, number> {
  const stats: Record<string, number> = {};
  const overs = numOrNull(bowling.overs);
  const wickets = numOrNull(bowling.wickets);
  const avg = numOrNull(bowling.average);
  const econ = numOrNull(bowling.economy);
  const inns = numOrNull(bowling.innings);
  if (inns != null) stats['Bowl Inns'] = inns;
  if (overs != null) stats.Overs = overs;
  if (wickets != null) stats.Wickets = wickets;
  if (avg != null) stats['Bowling Avg'] = avg;
  if (econ != null) stats.Economy = econ;
  return stats;
}

function duelRowsFromStats(
  a: Record<string, number>,
  b: Record<string, number>,
): { metric: string; valueA: string | number; valueB: string | number; winner: 'a' | 'b' | 'tie' | 'none' }[] {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  return keys.map((metric) => {
    const va = a[metric] ?? null;
    const vb = b[metric] ?? null;
    return {
      metric,
      valueA: va != null ? va : '—',
      valueB: vb != null ? vb : '—',
      winner: metricWinner(metric, va, vb),
    };
  });
}

function widgetsFromCompare(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const players = Array.isArray(o.players) ? o.players : [];
  if (players.length < 2) return [];

  const views: ComparePlayerView[] = players.slice(0, 4).map((p) => {
    const row = asRecord(p);
    const profile = asRecord(row.profile ?? row);
    const batting = asRecord(row.batting);
    const bowling = asRecord(row.bowling);
    const name =
      (typeof profile.fullname === 'string' && profile.fullname) ||
      (typeof profile.name === 'string' && profile.name) ||
      (typeof row.name === 'string' && row.name) ||
      'Player';
    const imageUrl = resolvePlayerPhoto(
      typeof profile.imagePath === 'string'
        ? profile.imagePath
        : typeof profile.imageUrl === 'string'
          ? profile.imageUrl
          : null,
      name,
    );
    const role = inferCompareRole(batting, bowling);
    return {
      name,
      imageUrl,
      role,
      batting: battingStatsMap(batting),
      bowling: bowlingStatsMap(bowling),
    };
  });

  const widgets: UIComponent[] = [];

  if (views.length === 2) {
    const [a, b] = views;
    widgets.push({
      type: 'duel_stage',
      playerA: {
        name: a.name,
        imageUrl: a.imageUrl,
        subtitle: roleLabel(a.role),
        chips: Object.entries(
          a.role === 'bowler' ? a.bowling : a.batting,
        )
          .slice(0, 2)
          .map(([label, value]) => ({ label, value })),
      },
      playerB: {
        name: b.name,
        imageUrl: b.imageUrl,
        subtitle: roleLabel(b.role),
        chips: Object.entries(
          b.role === 'bowler' ? b.bowling : b.batting,
        )
          .slice(0, 2)
          .map(([label, value]) => ({ label, value })),
      },
    });

    const sameBat =
      (a.role === 'batter' || a.role === 'allrounder') &&
      (b.role === 'batter' || b.role === 'allrounder') &&
      a.role === b.role &&
      a.role !== 'allrounder';
    const sameBowl = a.role === 'bowler' && b.role === 'bowler';
    const mixed =
      (a.role === 'batter' && b.role === 'bowler') ||
      (a.role === 'bowler' && b.role === 'batter');
    const bothAllround = a.role === 'allrounder' || b.role === 'allrounder';

    const showBat =
      sameBat || mixed || bothAllround || a.role === 'batter' || b.role === 'batter';
    const showBowl =
      sameBowl ||
      mixed ||
      bothAllround ||
      a.role === 'bowler' ||
      b.role === 'bowler' ||
      Object.keys(a.bowling).length > 0 ||
      Object.keys(b.bowling).length > 0;

    if (showBat && Object.keys(a.batting).length + Object.keys(b.batting).length > 0) {
      widgets.push({
        type: 'metric_duel',
        title: mixed ? 'Batting (by role)' : 'Batting',
        labelA: a.name,
        labelB: b.name,
        rows: duelRowsFromStats(a.batting, b.batting),
        insight: mixed
          ? 'Mixed roles — batting numbers are not a like-for-like contest.'
          : undefined,
      });
    }

    if (
      showBowl &&
      (Object.keys(a.bowling).length > 0 || Object.keys(b.bowling).length > 0)
    ) {
      // Skip empty bowling duel when both are pure batters with no wickets
      const anyWickets =
        (a.bowling.Wickets ?? 0) > 0 || (b.bowling.Wickets ?? 0) > 0;
      if (anyWickets || sameBowl || mixed) {
        widgets.push({
          type: 'metric_duel',
          title: mixed ? 'Bowling (by role)' : 'Bowling',
          labelA: a.name,
          labelB: b.name,
          rows: duelRowsFromStats(a.bowling, b.bowling),
          insight: mixed
            ? 'Mixed roles — bowling numbers favour the bowler; do not crown a single winner on batting average.'
            : undefined,
        });
      }
    }

    widgets.push({
      type: 'follow_up_chips',
      prompts: mixed
        ? [
            `Show ${a.name} vs ${b.name} matchup H2H`,
            'Compare batting only',
            'Compare bowling only',
          ]
        : ['Career stats instead of IPL', 'Add a third player'],
    });

    return widgets;
  }

  const entities = views.map((v) => ({
    name: v.name,
    imageUrl: v.imageUrl,
    subtitle: roleLabel(v.role),
    stats: {
      ...(v.role === 'bowler' ? v.bowling : v.batting),
      ...(v.role === 'allrounder' ? { ...v.batting, ...v.bowling } : {}),
    },
  }));

  return [
    {
      type: 'comparison_table',
      title: 'Comparison',
      entities,
    },
  ];
}

function widgetsFromMatchup(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const batter = asRecord(o.batter);
  const bowler = asRecord(o.bowler);
  const ballStats = asRecord(o.ballStats);
  const batterName =
    (typeof batter.name === 'string' && batter.name) || 'Batter';
  const bowlerName =
    (typeof bowler.name === 'string' && bowler.name) || 'Bowler';
  const batterImg = resolvePlayerPhoto(
    typeof batter.imagePath === 'string'
      ? batter.imagePath
      : typeof batter.imageUrl === 'string'
        ? batter.imageUrl
        : null,
    batterName,
  );
  const bowlerImg = resolvePlayerPhoto(
    typeof bowler.imagePath === 'string'
      ? bowler.imagePath
      : typeof bowler.imageUrl === 'string'
        ? bowler.imageUrl
        : null,
    bowlerName,
  );

  const dismissals = numOrNull(o.dismissals) ?? 0;
  const ballsFaced = numOrNull(ballStats.ballsFaced) ?? 0;
  const runsScored = numOrNull(ballStats.runsScored) ?? 0;
  const ballWickets = numOrNull(ballStats.wickets) ?? 0;
  const sr = numOrNull(ballStats.strikeRate);
  const ballAvailable = Boolean(ballStats.available);
  const note = typeof o.note === 'string' ? o.note : undefined;
  const roleAssignment =
    o.roleAssignment === 'inferred' ? 'Roles inferred from stats' : undefined;

  const widgets: UIComponent[] = [
    {
      type: 'duel_stage',
      playerA: {
        name: batterName,
        imageUrl: batterImg,
        subtitle: 'Batter',
        chips: [{ label: 'Dismissed', value: dismissals }],
      },
      playerB: {
        name: bowlerName,
        imageUrl: bowlerImg,
        subtitle: 'Bowler',
        chips: [{ label: 'Wickets H2H', value: dismissals }],
      },
    },
    {
      type: 'metric_duel',
      title: 'Head-to-head matchup',
      labelA: batterName,
      labelB: bowlerName,
      rows: [
        {
          metric: 'Dismissals',
          valueA: dismissals,
          valueB: dismissals,
          winner: dismissals > 0 ? 'b' : 'none',
        },
        ...(ballAvailable
          ? [
              {
                metric: 'Balls faced',
                valueA: ballsFaced,
                valueB: '—',
                winner: 'none' as const,
              },
              {
                metric: 'Runs scored',
                valueA: runsScored,
                valueB: '—',
                winner: 'none' as const,
              },
              {
                metric: 'Strike rate',
                valueA: sr != null ? sr : '—',
                valueB: '—',
                winner: 'none' as const,
              },
              {
                metric: 'Ball wickets',
                valueA: '—',
                valueB: ballWickets,
                winner: ballWickets > 0 ? ('b' as const) : ('none' as const),
              },
            ]
          : []),
      ],
      insight: [roleAssignment, note].filter(Boolean).join(' '),
    },
  ];

  const byType = Array.isArray(o.byDismissalType) ? o.byDismissalType : [];
  if (byType.length) {
    widgets.push({
      type: 'stats_table',
      headers: ['Dismissal type', 'Count', '%'],
      rows: byType.slice(0, 8).map((row) => {
        const r = asRecord(row);
        return [
          String(r.label ?? '—'),
          numOrNull(r.count) ?? 0,
          numOrNull(r.percentage) != null
            ? `${Math.round(Number(r.percentage) * 10) / 10}%`
            : '—',
        ];
      }),
    });
  }

  const recent = Array.isArray(o.recentDismissals) ? o.recentDismissals : [];
  if (recent.length) {
    widgets.push({
      type: 'stats_table',
      headers: ['Match', 'Date', 'How out', 'Score'],
      rows: recent.slice(0, 8).map((row) => {
        const r = asRecord(row);
        const runs = numOrNull(r.batterRuns);
        const balls = numOrNull(r.batterBalls);
        const score =
          runs != null
            ? balls != null
              ? `${runs} (${balls})`
              : String(runs)
            : '—';
        const date =
          typeof r.date === 'string' ? r.date.slice(0, 10) : '—';
        return [
          String(r.matchTitle ?? r.fixtureId ?? '—'),
          date,
          String(r.outcome ?? '—'),
          score,
        ];
      }),
    });
  }

  widgets.push({
    type: 'follow_up_chips',
    prompts: [
      `Compare ${batterName} and ${bowlerName} by role`,
      `${batterName} batting stats`,
      `${bowlerName} bowling stats`,
    ],
  });

  return widgets;
}

function widgetsFromScorecard(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const fixture = asRecord(o.fixture ?? o.match ?? o);
  const innings = Array.isArray(o.innings) ? o.innings : [];
  if (!innings.length) return [];

  const widgets: UIComponent[] = [];

  const local =
    (fixture.localTeamName as string) ||
    (fixture.localteamName as string) ||
    '';
  const visitor =
    (fixture.visitorTeamName as string) ||
    (fixture.visitorteamName as string) ||
    '';
  const status = (fixture.status as string) || undefined;
  const note = (fixture.note as string) || undefined;

  if (local || visitor) {
    widgets.push({
      type: 'match_header',
      match: {
        title:
          local && visitor
            ? `${local} vs ${visitor}`
            : local || visitor || 'Match',
        status,
        scoreLine: note,
        venue: (fixture.venueName as string) || undefined,
      },
    });
  }

  for (const inn of innings) {
    const meta = asRecord(inn);
    const teamName =
      (typeof meta.teamName === 'string' && meta.teamName) ||
      (typeof meta.scoreboard === 'string' && meta.scoreboard) ||
      'Innings';
    const battingRaw = Array.isArray(meta.batting) ? meta.batting : [];
    const bowlingRaw = Array.isArray(meta.bowling) ? meta.bowling : [];

    const batting = battingRaw.map((r) => {
      const row = asRecord(r);
      return {
        name:
          (typeof row.playerName === 'string' && row.playerName) ||
          (typeof row.name === 'string' && row.name) ||
          'Batter',
        runs: (row.runs as number | string) ?? 0,
        balls: (row.balls as number | string) ?? undefined,
        dismissal: formatDismissal(row),
      };
    });

    const bowling = bowlingRaw.map((r) => {
      const row = asRecord(r);
      return {
        name:
          (typeof row.playerName === 'string' && row.playerName) ||
          (typeof row.name === 'string' && row.name) ||
          'Bowler',
        overs: (row.overs as number | string) ?? 0,
        maidens: (row.maidens as number | string) ?? undefined,
        runs: (row.runsConceded as number | string) ?? (row.runs as number | string) ?? 0,
        wickets: (row.wickets as number | string) ?? 0,
        economy: (row.economy as number | string) ?? undefined,
      };
    });

    if (batting.length || bowling.length) {
      widgets.push({
        type: 'scorecard_mini',
        title: teamName,
        batting,
        bowling: bowling.length ? bowling : undefined,
      });
    }
  }

  return widgets;
}

/** True when model used batting[] for a "Bowling" card or omitted how-outs / bowling. */
function isWeakScorecardUi(ui: UIComponent[]): boolean {
  if (!ui.length) return true;
  const scorecards = ui.filter((w) => w.type === 'scorecard_mini');
  if (!scorecards.length) return true;

  for (const w of scorecards) {
    if (w.type !== 'scorecard_mini') continue;
    const title = (w.title ?? '').toLowerCase();
    if (title.includes('bowl') && !(w.bowling?.length)) {
      return true;
    }
    const bat = w.batting ?? [];
    const vague = bat.some((b) => {
      const d = (b.dismissal ?? '').toLowerCase();
      return (
        d === 'catch out' ||
        d === 'lbw out' ||
        d === 'bowled out' ||
        d === 'catch' ||
        d === 'lbw out'
      );
    });
    if (vague) return true;
    const hasAnyDismissal = bat.some((b) => Boolean(b.dismissal?.trim()));
    if (bat.length >= 3 && !hasAnyDismissal) return true;
  }

  const hasBowling =
    scorecards.some(
      (w) => w.type === 'scorecard_mini' && (w.bowling?.length ?? 0) > 0,
    ) ||
    ui.some(
      (w) =>
        w.type === 'stats_table' &&
        w.headers.some((h) => /bowl|econ|wicket/i.test(String(h))),
    );
  if (!hasBowling) return true;

  return false;
}

/** Collect tool outputs from AI SDK generateText result.toolResults. */
export function collectToolHits(
  toolResults: Array<{ toolName?: string; output?: unknown }> | undefined,
): ToolHit[] {
  if (!Array.isArray(toolResults)) return [];
  return toolResults
    .filter((t) => typeof t.toolName === 'string')
    .map((t) => ({ toolName: t.toolName as string, output: t.output }));
}

/**
 * If the model returned stats text but empty/weak widgets, build UI from the last
 * relevant MCP tool result. Chat-app only — does not change MCP payloads.
 */
function pageHasH2HWidget(ui: UIComponent[] | undefined): boolean {
  return (ui ?? []).some(
    (w) =>
      w.type === 'metric_duel' &&
      typeof w.title === 'string' &&
      /head-to-head|h2h|matchup/i.test(w.title),
  );
}

function widgetsFromRankings(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const rows = Array.isArray(o.rows) ? o.rows : [];
  if (!rows.length) return [];
  const metric = typeof o.metric === 'string' ? o.metric : 'runs';
  const widgets: UIComponent[] = [
    {
      type: 'podium',
      title: `Top by ${metric.replace('_', ' ')}`,
      entries: rows.slice(0, 3).map((r, i) => {
        const row = asRecord(r);
        const name =
          (typeof row.playerName === 'string' && row.playerName) || 'Player';
        return {
          rank: numOrNull(row.rank) ?? i + 1,
          name,
          imageUrl: resolvePlayerPhoto(
            typeof row.imagePath === 'string' ? row.imagePath : null,
            name,
          ),
          value: (row.value as string | number) ?? '—',
          metric,
        };
      }),
    },
    {
      type: 'stats_table',
      headers: ['Rank', 'Player', 'Value', 'Inns'],
      rows: rows.slice(0, 15).map((r) => {
        const row = asRecord(r);
        return [
          String(row.rank ?? ''),
          String(row.playerName ?? ''),
          String(row.value ?? ''),
          String(row.innings ?? ''),
        ];
      }),
    },
  ];
  if (typeof o.note === 'string' && o.note) {
    widgets.push({ type: 'text', content: o.note });
  }
  widgets.push({
    type: 'follow_up_chips',
    prompts: [
      'Show struggle vs left-arm pace for the #1 batter',
      'Best batting performances for the top player',
      'Compare top two batters IPL',
    ],
  });
  return widgets;
}

function widgetsFromVsBowling(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const player = asRecord(o.player);
  const name =
    (typeof player.name === 'string' && player.name) || 'Player';
  const vs = typeof o.vs === 'string' ? o.vs : 'bowling type';
  const struggle = asRecord(o.struggle);
  const ball = asRecord(o.ballStats);
  const overall = asRecord(o.overallBallStats);
  const widgets: UIComponent[] = [
    {
      type: 'player_hero',
      player: {
        name,
        imageUrl: resolvePlayerPhoto(
          typeof player.imagePath === 'string' ? player.imagePath : null,
          name,
        ),
        subtitle: `vs ${vs.replace(/_/g, ' ')}`,
        chips: [
          {
            label: 'Dismissals vs type',
            value: numOrNull(o.dismissalsVsType) ?? 0,
          },
          {
            label: 'Share %',
            value: numOrNull(o.dismissalSharePct) ?? '—',
          },
        ],
      },
    },
    {
      type: 'metric_duel',
      title: `Ball stats vs ${vs.replace(/_/g, ' ')}`,
      labelA: 'vs type',
      labelB: 'overall',
      rows: [
        {
          metric: 'Balls',
          valueA: numOrNull(ball.ballsFaced) ?? 0,
          valueB: numOrNull(overall.ballsFaced) ?? '—',
          winner: 'none' as const,
        },
        {
          metric: 'Runs',
          valueA: numOrNull(ball.runsScored) ?? 0,
          valueB: numOrNull(overall.runsScored) ?? '—',
          winner: 'none' as const,
        },
        {
          metric: 'Strike Rate',
          valueA: numOrNull(ball.strikeRate) ?? '—',
          valueB: numOrNull(overall.strikeRate) ?? '—',
          winner: 'none' as const,
        },
      ],
      insight:
        struggle.flagged === true
          ? `Struggle flagged: ${Array.isArray(struggle.reasons) ? struggle.reasons.join('; ') : ''}`
          : typeof struggle.definition === 'string'
            ? struggle.definition
            : undefined,
    },
  ];
  const fails = Array.isArray(o.recentFailInnings) ? o.recentFailInnings : [];
  if (fails.length) {
    widgets.push({
      type: 'stats_table',
      headers: ['Match', 'Outcome', 'Runs', 'Bowler'],
      rows: fails.slice(0, 8).map((f) => {
        const row = asRecord(f);
        return [
          String(row.matchTitle ?? row.fixtureId ?? ''),
          String(row.outcome ?? ''),
          String(row.batterRuns ?? ''),
          String(row.bowlerName ?? ''),
        ];
      }),
    });
  }
  if (typeof o.note === 'string' && o.note) {
    widgets.push({ type: 'text', content: o.note });
  }
  return widgets;
}

function widgetsFromPerformances(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const player = asRecord(o.player);
  const name =
    (typeof player.name === 'string' && player.name) || 'Player';
  const rows = Array.isArray(o.rows) ? o.rows : [];
  if (!rows.length) return [];
  const kind = typeof o.kind === 'string' ? o.kind : 'batting';
  const isBowl = kind === 'bowling';
  return [
    {
      type: 'player_hero',
      player: {
        name,
        imageUrl: resolvePlayerPhoto(
          typeof player.imagePath === 'string' ? player.imagePath : null,
          name,
        ),
        subtitle: `${typeof o.sort === 'string' ? o.sort : 'best'} ${kind}`,
      },
    },
    {
      type: 'stats_table',
      headers: isBowl
        ? ['Match', 'Overs', 'Wickets', 'Runs', 'Econ']
        : ['Match', 'Runs', 'Balls', 'SR', 'Dismissal'],
      rows: rows.slice(0, 12).map((r) => {
        const row = asRecord(r);
        if (isBowl) {
          return [
            String(row.matchTitle ?? row.fixtureId ?? ''),
            String(row.overs ?? ''),
            String(row.wickets ?? ''),
            String(row.runsConceded ?? ''),
            String(row.economy ?? ''),
          ];
        }
        return [
          String(row.matchTitle ?? row.fixtureId ?? ''),
          String(row.runs ?? ''),
          String(row.balls ?? ''),
          String(row.strikeRate ?? ''),
          String(row.dismissalOutcome ?? ''),
        ];
      }),
    },
    {
      type: 'follow_up_chips',
      prompts: rows.slice(0, 3).map((r) => {
        const row = asRecord(r);
        const id = String(row.fixtureId ?? '');
        return id
          ? `Show scorecard for fixture ${id}`
          : 'Show recent match scorecard';
      }),
    },
  ];
}

export function fillUiFromToolResults(
  page: CricInsightsResponse,
  toolResults: Array<{ toolName?: string; output?: unknown }> | undefined,
): CricInsightsResponse {
  const hits = collectToolHits(toolResults);
  const scorecardHit = [...hits]
    .reverse()
    .find((h) => h.toolName === 'get_match_scorecard');
  const matchupHit = hits.find((h) => h.toolName === 'get_batter_bowler_matchup');
  const rankingHit = hits.find((h) => h.toolName === 'query_player_rankings');
  const vsBowlingHit = hits.find((h) => h.toolName === 'query_player_vs_bowling');
  const performancesHit = hits.find(
    (h) => h.toolName === 'query_player_performances',
  );
  const hasAnalyticsHits = Boolean(
    rankingHit || vsBowlingHit || performancesHit,
  );
  const hasH2HInPage = pageHasH2HWidget(page.ui);

  const shouldReplaceScorecard =
    Boolean(scorecardHit) && isWeakScorecardUi(page.ui ?? []);

  // Prefer tool-backed analytics pages over model-invented widgets.
  if (hasAnalyticsHits) {
    const widgets: UIComponent[] = [];
    if (rankingHit) widgets.push(...widgetsFromRankings(rankingHit.output));
    if (vsBowlingHit) widgets.push(...widgetsFromVsBowling(vsBowlingHit.output));
    if (performancesHit) {
      widgets.push(...widgetsFromPerformances(performancesHit.output));
    }
    if (widgets.length) {
      const topName =
        rankingHit &&
        Array.isArray(asRecord(rankingHit.output).rows) &&
        asRecord(
          (asRecord(rankingHit.output).rows as unknown[])[0],
        ).playerName;
      return {
        ...page,
        layout: 'tournament',
        title:
          page.title && page.title !== 'CricInsights'
            ? page.title
            : typeof topName === 'string'
              ? `Analytics: ${topName}`
              : 'Player analytics',
        ai_summary: {
          headline:
            page.ai_summary?.headline && page.ai_summary.headline !== 'Insight'
              ? page.ai_summary.headline
              : 'Data-backed player analytics',
          text: page.ai_summary?.text || page.text,
        },
        ui: sanitizeUi(widgets),
      };
    }
  }

  if (page.ui?.length && !shouldReplaceScorecard) {
    // #region agent log
    // #endregion
    console.log('[hydrate-from-tools] skipped — model already returned widgets', {
      count: page.ui.length,
      types: page.ui.map((w) => w.type),
    });
    return page;
  }

  if (!hits.length) {
    console.log('[hydrate-from-tools] skipped — no tool results to build from');
    return page;
  }

  console.log('[hydrate-from-tools] attempting fill from tools', {
    toolNames: hits.map((h) => h.toolName),
    shouldReplaceScorecard,
  });

  let widgets: UIComponent[] = [];
  let layout = page.layout;
  let title = page.title;
  let headline = page.ai_summary?.headline || 'Insight';

  if (shouldReplaceScorecard && scorecardHit) {
    widgets = widgetsFromScorecard(scorecardHit.output);
    if (widgets.length) {
      layout = 'match_snapshot';
      if (!title || title === 'CricInsights') title = 'Match Scorecard';
      if (!headline || headline === 'Insight') headline = 'Scorecard';
      console.log('[hydrate-from-tools] rebuilt scorecard from get_match_scorecard', {
        types: widgets.map((w) => w.type),
      });
      return {
        ...page,
        layout,
        title,
        ai_summary: {
          headline,
          text: page.ai_summary?.text || page.text,
        },
        ui: sanitizeUi(widgets),
      };
    }
  }

  for (let i = hits.length - 1; i >= 0; i--) {
    const { toolName, output } = hits[i];
    if (toolName === 'get_player_stats_by_name') {
      widgets = widgetsFromPlayerStats(output);
      if (widgets.length) {
        layout = 'player_profile';
        const hero = widgets.find((w) => w.type === 'player_hero');
        if (hero?.type === 'player_hero') {
          const name = hero.player.name;
          if (!title || title === 'CricInsights') title = `${name}'s Stats`;
          if (!headline || headline === 'Insight') {
            headline = `${name}'s Performance`;
          }
        }
        break;
      }
    }
    // Prefer true H2H matchup over side-by-side compare when both ran.
    if (toolName === 'get_batter_bowler_matchup') {
      widgets = widgetsFromMatchup(output);
      // #region agent log
      const mOut = asRecord(output);
      // #endregion
      if (widgets.length) {
        layout = 'player_comparison';
        const batter = asRecord(asRecord(output).batter);
        const bowler = asRecord(asRecord(output).bowler);
        const bn =
          typeof batter.name === 'string' ? batter.name : 'Batter';
        const bl =
          typeof bowler.name === 'string' ? bowler.name : 'Bowler';
        if (!title || title === 'CricInsights') title = `${bn} vs ${bl}`;
        if (!headline || headline === 'Insight') {
          headline = 'Batter vs bowler matchup';
        }
        const compareHit = hits.find((h) => h.toolName === 'compare_players_by_name');
        if (compareHit) {
          const roleWidgets = widgetsFromCompare(compareHit.output).filter(
            (w) => w.type === 'metric_duel',
          );
          // Insert role duels after H2H duel stage / matchup block
          const insertAt = Math.min(2, widgets.length);
          widgets = [
            ...widgets.slice(0, insertAt),
            ...roleWidgets,
            ...widgets.slice(insertAt),
          ];
        }
        break;
      }
    }
    if (toolName === 'compare_players_by_name') {
      // Skip compare-only hydrate if a matchup hit exists later/earlier — handled above when matchup is found.
      if (hits.some((h) => h.toolName === 'get_batter_bowler_matchup')) {
        continue;
      }
      widgets = widgetsFromCompare(output);
      if (widgets.length) {
        layout = 'player_comparison';
        if (!title || title === 'CricInsights') title = 'Player Comparison';
        if (!headline || headline === 'Insight') headline = 'Role comparison';
        break;
      }
    }
    if (toolName === 'get_match_scorecard') {
      widgets = widgetsFromScorecard(output);
      if (widgets.length) {
        layout = 'match_snapshot';
        if (!title || title === 'CricInsights') title = 'Match Scorecard';
        if (!headline || headline === 'Insight') headline = 'Scorecard';
        break;
      }
    }
  }

  if (!widgets.length) {
    console.log('[hydrate-from-tools] no matching tool payload to build widgets');
    return page;
  }

  console.log('[hydrate-from-tools] built widgets from tools', {
    layout,
    title,
    types: widgets.map((w) => w.type),
  });

  return {
    ...page,
    layout,
    title,
    ai_summary: {
      headline,
      text: page.ai_summary?.text || page.text,
    },
    ui: sanitizeUi(widgets),
  };
}
