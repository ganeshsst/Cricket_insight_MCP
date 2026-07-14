import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const pg = require('../libs/database/node_modules/pg');
const dotenv = require('../apps/mcp-server/node_modules/dotenv');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const client = new pg.Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD?.replace(/^"|"$/g, ''),
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log('=== IPL leagues ===');
const leagues = await client.query(`
  SELECT sportmonks_id, name, code
  FROM master.leagues
  WHERE name ILIKE '%ipl%' OR name ILIKE '%indian premier%'
  ORDER BY name
`);
console.table(leagues.rows);

console.log('\n=== IPL 2026 seasons ===');
const seasons = await client.query(`
  SELECT s.sportmonks_id, s.name, l.name AS league_name
  FROM master.seasons s
  JOIN master.leagues l ON l.sportmonks_id = s.league_id
  WHERE (l.name ILIKE '%ipl%' OR l.name ILIKE '%indian premier%')
    AND s.name ILIKE '%2026%'
  ORDER BY s.name
`);
console.table(seasons.rows);

const iplLeagueId = leagues.rows[0]?.sportmonks_id;
const ipl2026SeasonId = seasons.rows[0]?.sportmonks_id;

console.log('\n=== Virat Kohli (46) - raw fact_batting rows IPL 2026 ===');
if (ipl2026SeasonId) {
  const raw = await client.query(`
    SELECT fb.fixture_id, fb.date_key, fb.runs_scored, fb.balls_faced, fb.fours, fb.sixes,
           ff.match_format, ff.league_id, ff.season_id, ff.status
    FROM gold.fact_batting fb
    JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
    WHERE fb.player_id = 46
      AND ff.season_id = $1::bigint
    ORDER BY fb.date_key, fb.fixture_id
  `, [ipl2026SeasonId]);
  console.log(`Rows: ${raw.rows.length}`);
  console.table(raw.rows);

  const agg = await client.query(`
    SELECT COUNT(DISTINCT fb.fixture_id) AS innings,
           SUM(fb.runs_scored) AS runs,
           SUM(fb.balls_faced) AS balls,
           SUM(fb.fours) AS fours,
           SUM(fb.sixes) AS sixes
    FROM gold.fact_batting fb
    JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
    WHERE fb.player_id = 46 AND ff.season_id = $1::bigint
  `, [ipl2026SeasonId]);
  console.log('\nAggregated IPL 2026:');
  console.table(agg.rows);
}

console.log('\n=== Virat Kohli - ALL formats aggregate (what API returns without filter) ===');
const all = await client.query(`
  SELECT COUNT(DISTINCT fb.fixture_id) AS innings,
         SUM(fb.runs_scored) AS runs,
         SUM(fb.balls_faced) AS balls
  FROM gold.fact_batting fb
  WHERE fb.player_id = 46
`);
console.table(all.rows);

console.log('\n=== Match formats for Virat in DB ===');
const formats = await client.query(`
  SELECT ff.match_format, ff.league_id, l.name AS league_name, COUNT(*) AS innings
  FROM gold.fact_batting fb
  JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
  LEFT JOIN master.leagues l ON l.sportmonks_id = ff.league_id
  WHERE fb.player_id = 46
  GROUP BY ff.match_format, ff.league_id, l.name
  ORDER BY innings DESC
  LIMIT 15
`);
console.table(formats.rows);

console.log('\n=== IPL fixtures 2026 sample ===');
if (ipl2026SeasonId) {
  const fixtures = await client.query(`
    SELECT ff.fixture_id, ff.date_key, ff.status, ff.match_format,
           lt.name AS local_team, vt.name AS visitor_team
    FROM gold.fact_fixture ff
    LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
    LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
    WHERE ff.season_id = $1::bigint
    ORDER BY ff.date_key
    LIMIT 10
  `, [ipl2026SeasonId]);
  console.table(fixtures.rows);
}

await client.end();
