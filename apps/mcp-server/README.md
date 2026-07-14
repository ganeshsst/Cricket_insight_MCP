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

## Tools

### Players
- `search_players`
- `get_player`
- `player_batting_stats`
- `player_bowling_stats`
- `get_player_career`
- `compare_players`

### Matches
- `list_matches`
- `get_match`
- `get_match_scorecard`

### Leagues & seasons
- `search_leagues`
- `list_seasons`
- `get_season_standings`
- `get_batting_leaderboard`
- `get_bowling_leaderboard`
- `get_season_coverage`

### Teams
- `search_teams`
- `get_team`
- `get_team_squad`

Configure in Cursor MCP settings with stdio pointing to `tsx src/index.ts` in this directory.
