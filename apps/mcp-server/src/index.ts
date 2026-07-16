import { config } from 'dotenv';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

const apiBase = process.env.CRICKET_API_URL ?? 'http://localhost:3001';
const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 3002);

/**
 * An explicit MCP_TRANSPORT always wins (e.g. hosted HTTP on Render/containers).
 * When unset, auto-detect: Cursor/IDE hosts pipe stdin (no TTY) → stdio.
 */
function resolveTransportMode(): 'stdio' | 'http' {
  const explicit = process.env.MCP_TRANSPORT?.toLowerCase();
  if (explicit === 'stdio') return 'stdio';
  if (explicit === 'http' || explicit === 'https') return 'http';
  if (explicit) {
    throw new Error(
      `Unsupported MCP_TRANSPORT "${process.env.MCP_TRANSPORT}". Use "http" or "stdio".`,
    );
  }
  return process.stdin.isTTY ? 'http' : 'stdio';
}

const transportMode = resolveTransportMode();

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

function buildQuery(
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function jsonText(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  return body ? JSON.parse(body) : undefined;
}

function createCricketMcpServer() {
const server = new McpServer({ name: 'cricket-insight-mcp', version: '1.0.0' });

server.tool(
  'search_players',
  'Search cricket players by name fragment',
  {
    q: z.string().describe('Player name search text'),
    limit: z.number().int().min(1).max(50).optional(),
    leagueId: z.number().int().optional().describe('Only include players associated with this league'),
  },
  async ({ q, limit, leagueId }) =>
    jsonText(
      await apiGet(`/players/search${buildQuery({ q, limit: limit ?? 20, leagueId })}`),
    ),
);

server.tool(
  'get_player',
  'Get player profile by SportMonks id',
  { sportmonksId: z.string().describe('Player SportMonks id') },
  async ({ sportmonksId }) => jsonText(await apiGet(`/players/${sportmonksId}`)),
);

server.tool(
  'player_batting_stats',
  'Aggregate batting stats for a player',
  {
    sportmonksId: z.string(),
    format: z.string().optional(),
    seasonId: z.number().int().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ sportmonksId, format, seasonId, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/${sportmonksId}/batting-stats${buildQuery({ format, seasonId, leagueId })}`,
      ),
    ),
);

server.tool(
  'player_bowling_stats',
  'Aggregate bowling stats for a player',
  {
    sportmonksId: z.string(),
    format: z.string().optional(),
    seasonId: z.number().int().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ sportmonksId, format, seasonId, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/${sportmonksId}/bowling-stats${buildQuery({ format, seasonId, leagueId })}`,
      ),
    ),
);

server.tool(
  'get_player_career',
  'Per-season batting and bowling career breakdown for a player',
  {
    sportmonksId: z.string(),
    format: z.string().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ sportmonksId, format, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/${sportmonksId}/career${buildQuery({ format, leagueId })}`,
      ),
    ),
);

server.tool(
  'compare_players_by_name',
  'Compare two players by name, resolving SportMonks ids automatically',
  {
    a: z.string().describe('First player name e.g. Virat Kohli'),
    b: z.string().describe('Second player name e.g. MS Dhoni'),
    format: z.string().optional(),
    seasonId: z.number().int().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ a, b, format, seasonId, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/compare-by-name${buildQuery({ a, b, format, seasonId, leagueId })}`,
      ),
    ),
);

server.tool(
  'get_player_stats_by_name',
  'Resolve a player by name and return profile plus batting and bowling stats',
  {
    q: z.string().describe('Player name search text'),
    format: z.string().optional(),
    seasonId: z.number().int().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ q, format, seasonId, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/by-name/stats${buildQuery({ q, format, seasonId, leagueId })}`,
      ),
    ),
);

server.tool(
  'player_dismissal_analysis',
  'Data-grounded batting weakness profile: how a player gets out (dismissal type, pace vs spin, bowling style, phase) from ingested scorecards',
  {
    q: z.string().describe('Player name e.g. Virat Kohli'),
    format: z.string().optional(),
    seasonId: z.number().int().optional(),
    leagueId: z.number().int().optional(),
  },
  async ({ q, format, seasonId, leagueId }) =>
    jsonText(
      await apiGet(
        `/players/by-name/dismissals${buildQuery({ q, format, seasonId, leagueId })}`,
      ),
    ),
);

server.tool(
  'list_matches',
  'List cricket matches with optional filters',
  {
    leagueId: z.number().int().optional(),
    seasonId: z.number().int().optional(),
    teamId: z.number().int().optional(),
    format: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async ({ leagueId, seasonId, teamId, format, limit, offset }) =>
    jsonText(
      await apiGet(
        `/matches${buildQuery({ leagueId, seasonId, teamId, format, limit, offset })}`,
      ),
    ),
);

server.tool(
  'search_matches',
  'Search matches with semantic filters like final or team-vs-team',
  {
    leagueId: z.number().int().optional(),
    seasonId: z.number().int().optional(),
    teamId: z.number().int().optional(),
    teamAId: z.number().int().optional(),
    teamBId: z.number().int().optional(),
    type: z.string().optional().describe('e.g. final'),
    format: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async ({ leagueId, seasonId, teamId, teamAId, teamBId, type, format, limit, offset }) =>
    jsonText(
      await apiGet(
        `/matches/search${buildQuery({ leagueId, seasonId, teamId, teamAId, teamBId, type, format, limit, offset })}`,
      ),
    ),
);

server.tool(
  'get_season_final',
  'Get the inferred final match for a league season',
  {
    leagueId: z.number().int(),
    seasonId: z.number().int(),
    format: z.string().optional(),
  },
  async ({ leagueId, seasonId, format }) =>
    jsonText(await apiGet(`/matches/final${buildQuery({ leagueId, seasonId, format })}`)),
);

server.tool(
  'get_match',
  'Get match detail including innings scores',
  { fixtureId: z.string().describe('Fixture SportMonks id') },
  async ({ fixtureId }) => jsonText(await apiGet(`/matches/${fixtureId}`)),
);

server.tool(
  'get_match_scorecard',
  'Full match scorecard with batting, bowling, and lineups',
  { fixtureId: z.string().describe('Fixture SportMonks id') },
  async ({ fixtureId }) =>
    jsonText(await apiGet(`/matches/${fixtureId}/scorecard`)),
);

server.tool(
  'get_match_coverage',
  'Scorecard row coverage for a fixture',
  { fixtureId: z.string().describe('Fixture SportMonks id') },
  async ({ fixtureId }) => jsonText(await apiGet(`/matches/${fixtureId}/coverage`)),
);

server.tool(
  'search_leagues',
  'Search cricket leagues by name e.g. IPL',
  { q: z.string().describe('League name search text') },
  async ({ q }) => jsonText(await apiGet(`/leagues/search${buildQuery({ q })}`)),
);

server.tool(
  'resolve_season',
  'Resolve a natural language league/season query e.g. IPL 2024',
  { q: z.string().describe('League and season query e.g. IPL 2024') },
  async ({ q }) => jsonText(await apiGet(`/leagues/resolve${buildQuery({ q })}`)),
);

server.tool(
  'list_seasons',
  'List seasons for a league',
  { leagueId: z.string().describe('League SportMonks id e.g. 1 for IPL') },
  async ({ leagueId }) =>
    jsonText(await apiGet(`/leagues/${leagueId}/seasons`)),
);

server.tool(
  'get_season_standings',
  'Points table / standings for a league season',
  {
    leagueId: z.string(),
    seasonId: z.string(),
  },
  async ({ leagueId, seasonId }) =>
    jsonText(await apiGet(`/leagues/${leagueId}/seasons/${seasonId}/standings`)),
);

server.tool(
  'get_batting_leaderboard',
  'Top batters for a league season',
  {
    leagueId: z.string(),
    seasonId: z.string(),
    format: z.string().optional().describe('e.g. T20 for IPL'),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async ({ leagueId, seasonId, format, limit }) =>
    jsonText(
      await apiGet(
        `/leagues/${leagueId}/seasons/${seasonId}/leaderboards/batting${buildQuery({ format, limit })}`,
      ),
    ),
);

server.tool(
  'get_bowling_leaderboard',
  'Top bowlers for a league season',
  {
    leagueId: z.string(),
    seasonId: z.string(),
    format: z.string().optional().describe('e.g. T20 for IPL'),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async ({ leagueId, seasonId, format, limit }) =>
    jsonText(
      await apiGet(
        `/leagues/${leagueId}/seasons/${seasonId}/leaderboards/bowling${buildQuery({ format, limit })}`,
      ),
    ),
);

server.tool(
  'get_season_coverage',
  'Scorecard ingest coverage for a league season (partial data awareness)',
  {
    leagueId: z.string(),
    seasonId: z.string(),
  },
  async ({ leagueId, seasonId }) =>
    jsonText(await apiGet(`/leagues/${leagueId}/seasons/${seasonId}/coverage`)),
);

server.tool(
  'search_teams',
  'Search cricket teams by name or code',
  {
    q: z.string().describe('Team name search text'),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async ({ q, limit }) =>
    jsonText(await apiGet(`/teams/search${buildQuery({ q, limit: limit ?? 20 })}`)),
);

server.tool(
  'get_team',
  'Get team profile by SportMonks id',
  { teamId: z.string().describe('Team SportMonks id') },
  async ({ teamId }) => jsonText(await apiGet(`/teams/${teamId}`)),
);

server.tool(
  'get_team_squad',
  'Team squad for a given season',
  {
    teamId: z.string(),
    seasonId: z.number().int().describe('Season SportMonks id e.g. 1795 for IPL 2026'),
  },
  async ({ teamId, seasonId }) =>
    jsonText(await apiGet(`/teams/${teamId}/squad${buildQuery({ seasonId })}`)),
);

server.tool(
  'get_team_head_to_head',
  'Head-to-head record between two teams',
  {
    teamAId: z.number().int(),
    teamBId: z.number().int(),
    leagueId: z.number().int().optional(),
  },
  async ({ teamAId, teamBId, leagueId }) =>
    jsonText(
      await apiGet(`/teams/head-to-head${buildQuery({ teamAId, teamBId, leagueId })}`),
    ),
);

server.tool(
  'get_venue',
  'Get venue usage summary',
  { venueId: z.string().describe('Venue SportMonks id') },
  async ({ venueId }) => jsonText(await apiGet(`/venues/${venueId}`)),
);

return server;
}

async function runStdio() {
  const server = createCricketMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cricket Insight MCP stdio transport active');
}

function runHttp() {
const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, name: 'cricket-insight-mcp' }));
    return;
  }

  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
    return;
  }

  const server = createCricketMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    const parsedBody = await readJsonBody(req);
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
  } catch (error) {
    console.error('MCP HTTP request failed:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'MCP request failed' }));
  }
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the other MCP HTTP process or set MCP_PORT.`,
    );
    process.exit(1);
  }
  throw error;
});

httpServer.listen(port, () => {
  console.error(`Cricket Insight MCP HTTP server listening on http://localhost:${port}/mcp`);
});
}

if (transportMode === 'stdio') {
  await runStdio();
} else {
  runHttp();
}
