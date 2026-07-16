# Future API & MCP Tool Backlog

**Purpose:** Track Cricket API endpoints and MCP tools to add when time allows. Items here came from real query gaps during IPL 2026 testing and known coverage limits in the current stack.

**Last updated:** July 2026  
**Current surface:** 26 MCP tools → Cricket API (`localhost:3001`) → Aurora Postgres (`master.*`, `gold.*`, `matches.*`)

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks common user questions; workaround today is slow or manual |
| **P1** | High value; data mostly exists in DB already |
| **P2** | Nice to have; may need ingest or schema work |
| **P3** | Larger data pipeline or consolidation effort |

---

## P0 — Season & team aggregates

These gaps showed up when answering questions like *"total 4s and 6s in IPL 2026"* and *"which team hit more 4s?"* Today the only workaround is looping over ~74 `get_match_scorecard` calls or hitting the API directly.

### 1. Season boundary totals

| Layer | Proposed |
|-------|----------|
| **API** | `GET /leagues/:leagueId/seasons/:seasonId/stats/boundaries` |
| **MCP** | `get_season_boundary_stats` |

**Returns:** `totalFours`, `totalSixes`, `boundaryRuns`, `matchesIncluded`, optional `format`

**SQL source:** `SUM(fours)`, `SUM(sixes)` from `matches.fixture_batting` joined to `gold.fact_fixture` for the season.

**Verified baseline (IPL 2026, seasonId `1795`):** 2,333 fours, 1,426 sixes, 17,888 boundary runs across 74 matches.

---

### 2. Team boundary leaderboard (season)

| Layer | Proposed |
|-------|----------|
| **API** | `GET /leagues/:leagueId/seasons/:seasonId/leaderboards/boundaries/teams` |
| **MCP** | `get_team_boundary_leaderboard` |

**Returns:** Per team: `fours`, `sixes`, `innings`, `foursPerInnings`, `sixesPerInnings`  
**Query params:** `format`, `sortBy` (`fours` \| `sixes`)

**Example (IPL 2026):** Gujarat Titans led with 292 fours; KKR had the fewest (192).

---

### 3. Player boundary leaderboard (season)

| Layer | Proposed |
|-------|----------|
| **API** | `GET /leagues/:leagueId/seasons/:seasonId/leaderboards/boundaries/batting` |
| **MCP** | `get_boundary_leaderboard` (or extend batting leaderboard) |

**Returns:** Top players by fours and/or sixes (not only runs).

**Note:** Current batting leaderboard is capped at **50** players (`LeaderboardQueryDto @Max(50)`), so summing it undercounts season totals (top 50 only: 1,813 fours / 1,103 sixes vs full season 2,333 / 1,426).

---

## P0 — MCP parity (API exists, no MCP tool yet)

| API endpoint | Proposed MCP tool | Why |
|--------------|-------------------|-----|
| `GET /players/compare?ids=` | `compare_players` | Compare by ID without name resolution |
| `GET /players/:id/matches` | `get_player_matches` | Fixture-level batting/bowling match log |
| `GET /leagues/.../awards` | `get_season_awards` | Orange Cap / Purple Cap in one call |
| `GET /leagues/.../playoffs` | `get_season_playoffs` | Playoff bracket without `search_matches` |
| `GET /teams/:teamId/season-stats` | `get_team_season_stats` | Team W/L, runs for/against, etc. |
| `GET /players/:id/dismissals` | Extend `player_dismissal_analysis` | Support `sportmonksId` in addition to `q` |

---

## P1 — Query ergonomics & filters

### 4. Date filter on matches

| Layer | Proposed |
|-------|----------|
| **API** | Add `date`, `dateFrom`, `dateTo` to `GET /matches` and `GET /matches/search` |
| **MCP** | Add same params to `list_matches` / `search_matches` |

**Use case:** "Matches on 20 May 2026" without scanning the full season list.

---

### 5. Player name aliases

| Layer | Proposed |
|-------|----------|
| **API** | `GET /players/resolve?q=` or alias table + improved search |
| **MCP** | `resolve_player` (optional; or improve `search_players`) |

**Known gap:** `"MS Dhoni"` fails; `"Mahendra Singh Dhoni"` works.

**Options:**
- `master.player_aliases` table (`alias` → `player_id`)
- Common nicknames in resolver (MS, VK, etc.)

---

### 6. Team head-to-head by name

| Layer | Proposed |
|-------|----------|
| **API** | `GET /teams/head-to-head-by-name?teamA=&teamB=` |
| **MCP** | `get_team_head_to_head_by_name` |

**Use case:** "MI vs CSK" without resolving team IDs first.

---

### 7. Leaderboard limit & completeness

| Change | Detail |
|--------|--------|
| Raise `@Max(50)` on leaderboards | Or add `GET .../leaderboards/batting/all` for full season export |
| Season stat summary | `GET /leagues/.../seasons/:id/summary` — total runs, wickets, 4s, 6s, matches |

---

## P1 — Dismissal analysis improvements

### 8. Fielder on catch dismissals

| Layer | Work |
|-------|------|
| **Ingest** | Store `fielder_id` from SportMonks on catch rows |
| **Schema** | `matches.fixture_batting.fielder_id` (nullable) |
| **API** | Expose in scorecard + dismissal breakdown (`byFielder`, `caughtAtPosition` if available) |
| **MCP** | Extend `player_dismissal_analysis` |

**Known gap:** "Who caught Cameron Green?" — only bowler + dismissal type stored today.

---

### 9. Batter vs bowler matchup stats

| Layer | Proposed |
|-------|----------|
| **API** | `GET /players/matchup?batterId=&bowlerId=` (or by name) |
| **MCP** | `get_batter_bowler_matchup` |

**Returns:** Balls faced, runs, dismissals, strike rate from scorecard rows where both appear.

**Limitation:** No true ball-by-ball without ball-level ingest (see P2 #10).

---

## P2 — Match & live data

### 10. Ball-by-ball feed

| Layer | Proposed |
|-------|----------|
| **Ingest** | Ball-by-ball table from SportMonks |
| **API** | `GET /matches/:fixtureId/balls` |
| **MCP** | `get_match_ball_by_ball` |

**Enables:** Over-by-over analysis, wagon wheels, exact "Gill vs Bumrah on 6 balls".

---

### 11. Match status filter on list_matches

| Layer | Proposed |
|-------|----------|
| **API/MCP** | `status` param on `list_matches` (`Finished`, `NS`, `Live`, etc.) |

**Note:** Filtering by status is not exposed on MCP `list_matches` today.

---

### 12. Venue season stats

| Layer | Proposed |
|-------|----------|
| **API** | `GET /venues/:venueId/season-stats?seasonId=` |
| **MCP** | `get_venue_season_stats` |

**Returns:** Average score, 4s/6s per innings, chase win %.

---

### 13. Phase batting / bowling leaderboards

| Layer | Proposed |
|-------|----------|
| **API** | `GET /leagues/.../leaderboards/batting?phase=powerplay\|middle\|death` |
| **MCP** | `get_phase_leaderboard` |

**Source:** Phase classification logic already exists in `player_dismissal_analysis` (`players.service.ts`).

---

## P2 — Data coverage & ingest

| Item | Gap | Action |
|------|-----|--------|
| ODI World Cup | No India–Pakistan ODI H2H in DB | Ingest ODI leagues/seasons |
| International bilateral series | Partial coverage | Expand league/season ingest scope |
| Abandoned matches | May have partial scorecards | Document behaviour in coverage API |
| Substitute / impact player stats | Lineup only today | Optional playing-role flags on batting rows |
| National team filters | `leagueId` on player search exists | Broader format filters (Test, ODI, T20I) |

---

## P3 — Consolidation & developer experience

### MCP tool consolidation (optional)

| Current | Possible merge |
|---------|----------------|
| `search_matches` + `list_matches` | One `list_matches` with richer filters |
| `get_batting_leaderboard` + boundary leaderboard | One leaderboard with `metric=runs\|fours\|sixes` |
| `get_player` + `get_player_stats_by_name` | Keep separate; document when to use each |

### Documentation to add alongside implementation

- `docs/MCP_QUERY_COOKBOOK.md` — how to answer common questions with current tools
- `docs/DATA_COVERAGE.md` — what leagues/formats are ingested vs missing
- Swagger examples for new endpoints

### Observability

- API response `meta.coverageNote` on aggregate endpoints (partial ingest awareness)
- Align MCP param types (`leagueId`/`seasonId` string vs number inconsistency across tools)

---

## Suggested implementation order

1. **Season boundary stats** (API + MCP) — one-call answer for season 4s/6s totals
2. **Team boundary leaderboard** — one-call answer for "which team hit more 4s"
3. **MCP parity** — awards, playoffs, team season stats, player matches
4. **Date filter on matches**
5. **Player alias resolution**
6. **Fielder on dismissals** (ingest + API)
7. **Batter vs bowler matchup**
8. **Ball-by-ball** (larger ingest project)

---

## Current MCP tools (26)

`search_players`, `get_player`, `player_batting_stats`, `player_bowling_stats`, `get_player_career`, `compare_players_by_name`, `get_player_stats_by_name`, `player_dismissal_analysis`, `list_matches`, `search_matches`, `get_season_final`, `get_match`, `get_match_scorecard`, `get_match_coverage`, `search_leagues`, `resolve_season`, `list_seasons`, `get_season_standings`, `get_batting_leaderboard`, `get_bowling_leaderboard`, `get_season_coverage`, `search_teams`, `get_team`, `get_team_squad`, `get_team_head_to_head`, `get_venue`

---

## Example API response (P0 #1)

```http
GET /leagues/1/seasons/1795/stats/boundaries?format=T20
```

```json
{
  "leagueId": "1",
  "seasonId": "1795",
  "leagueName": "Indian Premier League",
  "seasonName": "2026",
  "format": "T20",
  "matchesIncluded": 74,
  "totalFours": 2333,
  "totalSixes": 1426,
  "boundaryRuns": 17888
}
```

---

## Example API response (P0 #2)

```http
GET /leagues/1/seasons/1795/leaderboards/boundaries/teams?format=T20&sortBy=fours
```

```json
{
  "leagueId": "1",
  "seasonId": "1795",
  "format": "T20",
  "teams": [
    { "teamId": "1976", "teamName": "Gujarat Titans", "innings": 17, "fours": 292, "sixes": 0 },
    { "teamId": "8", "teamName": "Royal Challengers Bengaluru", "innings": 16, "fours": 261, "sixes": 0 }
  ]
}
```

*(Sixes omitted in sketch; full response would include both.)*

---

## Useful IDs (reference)

| Entity | SportMonks id |
|--------|---------------|
| IPL | `leagueId=1` |
| IPL 2026 | `seasonId=1795` |
| India | `teamId=10` |
| New Zealand | `teamId=42` |
