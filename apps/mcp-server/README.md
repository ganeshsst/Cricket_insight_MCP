# MCP Server

Model Context Protocol tools that call the Cricket API over HTTP.

## Prerequisites

Cricket API running at `CRICKET_API_URL` (default `http://localhost:3001`).

## Run locally

```bash
cd apps/mcp-server
npm install
npm run dev
```

Transport is chosen automatically:

- **stdio** — when stdin is piped (e.g. Cursor MCP host)
- **http** — when run interactively; listens on `MCP_PORT` (default `3002`) at `/mcp`

Set `MCP_TRANSPORT=stdio` or `MCP_TRANSPORT=http` to override.

## HTTP endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/mcp` | Streamable HTTP MCP transport |

## Tools

Each tool maps 1:1 to a Cricket API endpoint. See [cricket-api README](../cricket-api/README.md) for full path details.

### Analytics

| Tool | API path |
|------|----------|
| `query_player_rankings` | `GET /analytics/player-rankings` |
| `query_player_vs_bowling` | `GET /analytics/player-vs-bowling` |
| `query_player_performances` | `GET /analytics/player-performances` |
| `query_multi_dismissals` | `GET /analytics/multi-dismissals` |

Use these for find/rank, vs bowling-type weakness, match-level proof, and same-match multi-dismissals (few tools, rich filters).

### Players

| Tool | API path |
|------|----------|
| `search_players` | `GET /players/search` |
| `get_player` | `GET /players/:sportmonksId` |
| `player_batting_stats` | `GET /players/:sportmonksId/batting-stats` |
| `player_bowling_stats` | `GET /players/:sportmonksId/bowling-stats` |
| `get_player_career` | `GET /players/:sportmonksId/career` |
| `compare_players_by_name` | `GET /players/compare-by-name` |
| `get_batter_bowler_matchup` | `GET /players/matchup-by-name` |
| `get_player_stats_by_name` | `GET /players/by-name/stats` |
| `player_dismissal_analysis` | `GET /players/by-name/dismissals` |

### Matches

| Tool | API path |
|------|----------|
| `list_matches` | `GET /matches` |
| `search_matches` | `GET /matches/search` |
| `get_season_final` | `GET /matches/final` |
| `get_match` | `GET /matches/:fixtureId` |
| `get_match_scorecard` | `GET /matches/:fixtureId/scorecard` |
| `get_match_coverage` | `GET /matches/:fixtureId/coverage` |

### Leagues & seasons

| Tool | API path |
|------|----------|
| `search_leagues` | `GET /leagues/search` |
| `resolve_season` | `GET /leagues/resolve` |
| `list_seasons` | `GET /leagues/:leagueId/seasons` |
| `get_season_standings` | `GET /leagues/:leagueId/seasons/:seasonId/standings` |
| `get_batting_leaderboard` | `GET /leagues/.../leaderboards/batting` |
| `get_bowling_leaderboard` | `GET /leagues/.../leaderboards/bowling` |
| `get_season_coverage` | `GET /leagues/.../coverage` |

### Teams

| Tool | API path |
|------|----------|
| `search_teams` | `GET /teams/search` |
| `get_team` | `GET /teams/:teamId` |
| `get_team_squad` | `GET /teams/:teamId/squad` |
| `get_team_head_to_head` | `GET /teams/head-to-head` |

### Venues

| Tool | API path |
|------|----------|
| `get_venue` | `GET /venues/:venueId` |

The MCP server exposes **26 tools** to Cursor and CricInsights chat, including
`player_dismissal_analysis` for data-grounded batting weakness profiles.
The Cricket API retains all REST endpoints, including those not exposed as
MCP tools. `get_match_coverage`, `get_season_coverage`, and `get_venue` remain
available.

## Cursor configuration

Configure in Cursor MCP settings with stdio pointing to `tsx src/index.ts` in this directory, or HTTP at `http://localhost:3002/mcp`.
