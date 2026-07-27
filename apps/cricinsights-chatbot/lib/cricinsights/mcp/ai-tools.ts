import { jsonSchema, tool } from 'ai';
import { isLlmExposedMcpTool } from '@/lib/cricinsights/mcp/llm-tool-allowlist';
import { callRemoteMcpTool, listRemoteMcpTools } from '@/lib/cricinsights/mcp/remote-tools';
import { asRecord } from '@/lib/cricinsights/utils';

export interface BuildAiToolsOptions {
  maxWebSearches?: number;
}

const IPL_LEAGUE_ID = 1;
const IPL_FORMAT = 'T20';
const SCOPED_STATS_TOOLS = new Set([
  'compare_players_by_name',
  'get_batter_bowler_matchup',
]);

type CompareLike = {
  players?: Array<{
    batting?: { innings?: number; runs?: number };
  }>;
};

function withDefaultIplScope(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...input };
  if (next.leagueId == null && next.seasonId == null) {
    next.leagueId = IPL_LEAGUE_ID;
    next.format = next.format ?? IPL_FORMAT;
  }
  return next;
}

function isEmptyBattingScope(result: unknown): boolean {
  const players = (result as CompareLike)?.players;
  if (Array.isArray(players) && players.length > 0) {
    return players.every(
      (p) => (p.batting?.innings ?? 0) === 0 && (p.batting?.runs ?? 0) === 0,
    );
  }
  return false;
}

function annotateAppliedScope(
  result: unknown,
  args: Record<string, unknown>,
): unknown {
  const record = asRecord(result);
  const leagueId = args.leagueId ?? null;
  const format = args.format ?? null;
  const seasonId = args.seasonId ?? null;
  const scope = asRecord(record.scope);

  let label = 'unscoped / mixed formats';
  if (leagueId === IPL_LEAGUE_ID || leagueId === '1') {
    const seasonLabel =
      (typeof scope.seasonName === 'string' && scope.seasonName) ||
      (seasonId != null ? `seasonId=${String(seasonId)}` : null);
    label =
      seasonLabel != null
        ? `IPL T20 (${seasonLabel})`
        : 'IPL T20 (all IPL seasons loaded)';
  } else if (leagueId != null) {
    label = `leagueId=${String(leagueId)}${format ? `, format=${String(format)}` : ''}`;
  } else if (format) {
    label = `format=${String(format)}`;
  }

  return {
    ...record,
    appliedScope: {
      leagueId,
      format,
      seasonId,
      seasonName: scope.seasonName ?? null,
      leagueName: scope.leagueName ?? null,
      label,
      note: 'State this scope in your answer text. Use scope.seasonName for the year label — never invent a different season year.',
    },
  };
}

async function callScopedStatsTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const scoped = withDefaultIplScope(input);
  let result = await callRemoteMcpTool(name, scoped);

  const leagueId = Number(scoped.leagueId);
  if (
    isEmptyBattingScope(result) &&
    Number.isFinite(leagueId) &&
    leagueId !== IPL_LEAGUE_ID
  ) {
    const retry: Record<string, unknown> = {
      ...scoped,
      leagueId: IPL_LEAGUE_ID,
      format: IPL_FORMAT,
    };
    delete retry.seasonId;
    result = await callRemoteMcpTool(name, retry);
    return annotateAppliedScope(result, retry);
  }

  return annotateAppliedScope(result, scoped);
}

function toolDescription(name: string, remoteDescription?: string): string {
  const base = remoteDescription ?? `Call the ${name} cricket tool`;
  if (name === 'compare_players_by_name') {
    return `${base}. When leagueId and seasonId are omitted, defaults to IPL T20 (leagueId=1, format=T20). For a specific season/year, call resolve_season first and pass its seasonId — never hardcode ids. Season-scoped stats are summed from scorecards. Copy scope.seasonName in your summary.`;
  }
  if (name === 'get_batter_bowler_matchup') {
    return `${base}. True H2H dismissals (and ball stats when available). Prefer batter+bowler names. When leagueId/seasonId omitted, defaults to IPL T20. For bat-vs-bowl questions also call compare_players_by_name.`;
  }
  return base;
}

/** AI SDK tool set backed by the remote HTTP MCP server. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildAiTools(
  options: BuildAiToolsOptions = {},
): Promise<Record<string, any>> {
  const maxWebSearches = options.maxWebSearches ?? 1;
  let webSearchCalls = 0;
  const remoteTools = (await listRemoteMcpTools()).filter((t) =>
    isLlmExposedMcpTool(t.name),
  );

  return Object.fromEntries(
    remoteTools.map((t) => [
      t.name,
      tool({
        description: toolDescription(t.name, t.description),
        inputSchema: jsonSchema<Record<string, unknown>>(
          t.inputSchema as Record<string, unknown>,
        ),
        execute: async (input) => {
          if (t.name === 'search_web') {
            if (webSearchCalls >= maxWebSearches) {
              return {
                error:
                  'Web search budget exhausted for this request. Answer from database tool results only.',
              };
            }
            webSearchCalls++;
          }

          const args = asRecord(input);
          if (SCOPED_STATS_TOOLS.has(t.name)) {
            return callScopedStatsTool(t.name, args);
          }

          return callRemoteMcpTool(t.name, args);
        },
      }),
    ]),
  );
}
