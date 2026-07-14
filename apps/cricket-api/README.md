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

## P0 endpoints

| Method | Path |
|--------|------|
| GET | `/players/search?q=` |
| GET | `/players/:sportmonksId` |
| GET | `/players/:sportmonksId/batting-stats` |
| GET | `/players/:sportmonksId/bowling-stats` |
| GET | `/matches` |
| GET | `/matches/:fixtureId` |

## P1 endpoints

| Method | Path |
|--------|------|
| GET | `/leagues/search?q=` |
| GET | `/leagues/:leagueId/seasons` |
| GET | `/leagues/:leagueId/seasons/:seasonId/standings` |
| GET | `/leagues/:leagueId/seasons/:seasonId/leaderboards/batting` |
| GET | `/leagues/:leagueId/seasons/:seasonId/leaderboards/bowling` |
| GET | `/leagues/:leagueId/seasons/:seasonId/coverage` |
| GET | `/teams/search?q=` |
| GET | `/teams/:teamId` |
| GET | `/teams/:teamId/squad?seasonId=` |
| GET | `/matches/:fixtureId/scorecard` |
| GET | `/players/:sportmonksId/career` |
| GET | `/players/compare?ids=` |

Useful IDs: IPL `leagueId=1`, IPL 2026 `seasonId=1795`, format `T20`.

Public ids use SportMonks `sportmonks_id`.
