import type { CricInsightsResponse, UIComponent } from '@/types/generative-ui';
import { asRecord, resolvePlayerPhoto } from '@/lib/utils';
import { sanitizeUi } from '@/lib/ai/hydrate';

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

function widgetsFromCompare(out: unknown): UIComponent[] {
  const o = asRecord(out);
  const players = Array.isArray(o.players) ? o.players : [];
  if (players.length < 2) return [];

  const entities = players.slice(0, 4).map((p) => {
    const row = asRecord(p);
    const profile = asRecord(row.profile ?? row);
    const batting = asRecord(row.batting);
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
    const stats: Record<string, string | number> = {};
    if (batting.runs != null) stats.Runs = Number(batting.runs);
    if (batting.average != null) stats.Average = Number(batting.average);
    if (batting.strikeRate != null) stats['Strike Rate'] = Number(batting.strikeRate);
    if (batting.innings != null) stats.Innings = Number(batting.innings);
    return { name, imageUrl, stats };
  });

  if (entities.length === 2) {
    return [
      {
        type: 'duel_stage',
        playerA: {
          name: entities[0].name,
          imageUrl: entities[0].imageUrl,
        },
        playerB: {
          name: entities[1].name,
          imageUrl: entities[1].imageUrl,
        },
      },
      {
        type: 'comparison_table',
        title: 'Head-to-head',
        entities,
      },
    ];
  }

  return [
    {
      type: 'comparison_table',
      title: 'Comparison',
      entities,
    },
  ];
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
export function fillUiFromToolResults(
  page: CricInsightsResponse,
  toolResults: Array<{ toolName?: string; output?: unknown }> | undefined,
): CricInsightsResponse {
  const hits = collectToolHits(toolResults);
  const scorecardHit = [...hits]
    .reverse()
    .find((h) => h.toolName === 'get_match_scorecard');

  const shouldReplaceScorecard =
    Boolean(scorecardHit) && isWeakScorecardUi(page.ui ?? []);

  if (page.ui?.length && !shouldReplaceScorecard) {
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
    if (toolName === 'compare_players_by_name') {
      widgets = widgetsFromCompare(output);
      if (widgets.length) {
        layout = 'player_comparison';
        if (!title || title === 'CricInsights') title = 'Player Comparison';
        if (!headline || headline === 'Insight') headline = 'Head-to-head';
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
