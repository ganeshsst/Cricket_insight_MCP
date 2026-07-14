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

const coverage = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM gold.fact_fixture WHERE season_id = 1795) AS total_ipl2026_fixtures,
    (SELECT COUNT(DISTINCT fb.fixture_id)
     FROM gold.fact_batting fb
     JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
     WHERE fb.player_id = 46 AND ff.season_id = 1795) AS kohli_ipl2026_innings_in_db,
    (SELECT COUNT(DISTINCT fb.fixture_id)
     FROM gold.fact_batting fb
     JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
     WHERE ff.season_id = 1795) AS all_players_batting_fixtures_ipl2026
`);
console.log('IPL 2026 data coverage:');
console.table(coverage.rows);

const kohliAllIpl = await client.query(`
  SELECT ff.season_id, s.name AS season_name, COUNT(DISTINCT fb.fixture_id) AS innings, SUM(fb.runs_scored) AS runs
  FROM gold.fact_batting fb
  JOIN gold.fact_fixture ff ON ff.fixture_id = fb.fixture_id
  JOIN master.seasons s ON s.sportmonks_id = ff.season_id
  WHERE fb.player_id = 46 AND ff.league_id = 1
  GROUP BY ff.season_id, s.name
  ORDER BY s.name DESC
`);
console.log('\nKohli IPL by season in DB:');
console.table(kohliAllIpl.rows);

await client.end();
