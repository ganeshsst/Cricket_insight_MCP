# Cricket API

NestJS business services for Cricket Insight. Read-only queries against Aurora (`master.*`, `gold.*`, `matches.*`).

## Run locally

From monorepo root (with `.env` configured):

```bash
cd apps/cricket-api
npm install
npm run dev
```

- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

## Endpoints

All routes are `GET`. Public ids use SportMonks `sportmonks_id`.

### Players (`/players`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/players/search?q=` | Search players by name |
| GET | `/players/compare?ids=` | Compare 2–4 players side by side (comma-separated ids) |
| GET | `/players/compare-by-name?a=&b=` | Compare two players by name |
| GET | `/players/matchup?batterId=&bowlerId=` | Batter vs bowler H2H (dismissals + ball stats) |
| GET | `/players/matchup-by-name?batter=&bowler=` | Same H2H by name (`a`+`b` also works for role inference) |
| GET | `/players/by-name/stats?q=` | Resolve a player by name and return profile + batting/bowling stats |
| GET | `/players/by-name/dismissals?q=` | Resolve a player by name and return dismissal/weakness profile |
| GET | `/players/:sportmonksId` | Player profile |
| GET | `/players/:sportmonksId/batting-stats` | Aggregate batting stats |
| GET | `/players/:sportmonksId/bowling-stats` | Aggregate bowling stats |
| GET | `/players/:sportmonksId/career` | Per-season batting and bowling career breakdown |
| GET | `/players/:sportmonksId/matches` | Fixture-level batting and bowling match log |
| GET | `/players/:sportmonksId/dismissals` | Dismissal breakdown (type, pace vs spin, phase) |

Optional query params for stats/career/matches: `format`, `seasonId`, `leagueId`, `limit`.

When `seasonId` is set, player batting/bowling stats for compare and `/by-name/stats` are **aggregated from ingested scorecards** (`fixture_batting` / `fixture_bowling`). League-wide career queries (`leagueId` only) use `player_career_stats`.

### Matches (`/matches`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/matches` | List matches with optional filters |
| GET | `/matches/search` | Search matches (team vs team, final, etc.) |
| GET | `/matches/final` | Inferred final match for a league season |
| GET | `/matches/:fixtureId` | Match summary with innings scores |
| GET | `/matches/:fixtureId/scorecard` | Full scorecard with batting, bowling, and lineups |
| GET | `/matches/:fixtureId/coverage` | Scorecard row coverage for a fixture |

Optional query params for list/search: `leagueId`, `seasonId`, `teamId`, `teamAId`, `teamBId`, `type`, `format`, `limit`, `offset`.

### Leagues (`/leagues`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/leagues/search?q=` | Search leagues (e.g. IPL) |
| GET | `/leagues/resolve?q=` | Resolve a natural-language league/season query (e.g. `IPL 2024`) |
| GET | `/leagues/:leagueId/seasons` | List seasons for a league |
| GET | `/leagues/:leagueId/seasons/:seasonId/standings` | Season points table |
| GET | `/leagues/:leagueId/seasons/:seasonId/leaderboards/batting` | Top batters for a season |
| GET | `/leagues/:leagueId/seasons/:seasonId/leaderboards/bowling` | Top bowlers for a season |
| GET | `/leagues/:leagueId/seasons/:seasonId/awards` | Orange Cap and Purple Cap winners |
| GET | `/leagues/:leagueId/seasons/:seasonId/playoffs` | Inferred playoff matches |
| GET | `/leagues/:leagueId/seasons/:seasonId/coverage` | Scorecard ingest coverage for a season |

Optional query params for leaderboards/awards: `format`, `limit`.

### Teams (`/teams`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/teams/search?q=` | Search teams by name or code |
| GET | `/teams/head-to-head?teamAId=&teamBId=` | Head-to-head record between two teams |
| GET | `/teams/:teamId` | Team profile |
| GET | `/teams/:teamId/squad?seasonId=` | Team squad for a season |
| GET | `/teams/:teamId/season-stats` | Team aggregate season stats |

Optional query params for head-to-head and season-stats: `leagueId`.

### Venues (`/venues`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/venues/:venueId` | Venue usage summary |

## Useful IDs

| Entity | SportMonks id |
|--------|---------------|
| IPL | `leagueId=1` |
| IPL 2026 | `seasonId=1795` |
| India | `teamId=10` |
| New Zealand | `teamId=42` |

Format filter example: `format=T20`.
