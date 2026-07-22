import dotenv from 'dotenv';
import { closePool, getPool } from '@cricket-ai/database';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: join(root, '.env') });
const pool = await getPool();

const officialCols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'master' AND table_name = 'officials'
  ORDER BY ordinal_position
`);
console.log('master.officials', JSON.stringify(officialCols.rows, null, 2));

const dimCols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'gold' AND table_name = 'dim_official'
  ORDER BY ordinal_position
`);
console.log('gold.dim_official', JSON.stringify(dimCols.rows, null, 2));

const sampleOfficials = await pool.query(`SELECT * FROM master.officials LIMIT 5`);
console.log('sample officials', JSON.stringify(sampleOfficials.rows, null, 2));

const coverage = await pool.query(`
  SELECT
    COUNT(*)::int AS total_fixtures,
    COUNT(first_umpire_id)::int AS with_first_umpire,
    COUNT(second_umpire_id)::int AS with_second_umpire,
    COUNT(tv_umpire_id)::int AS with_tv_umpire,
    COUNT(referee_id)::int AS with_referee
  FROM matches.fixtures mf
  JOIN gold.fact_fixture ff ON ff.fixture_id = mf.sportmonks_id
  WHERE ff.season_id = 1795
`);
console.log('IPL 2026 coverage', JSON.stringify(coverage.rows[0], null, 2));

const sampleMatch = await pool.query(`
  SELECT mf.sportmonks_id::text AS fixture_id,
         ff.date_key::text AS date,
         lt.name AS local_team,
         vt.name AS visitor_team,
         mf.first_umpire_id::text,
         u1.fullname AS first_umpire,
         mf.second_umpire_id::text,
         u2.fullname AS second_umpire,
         mf.tv_umpire_id::text,
         u3.fullname AS tv_umpire,
         mf.referee_id::text,
         r.fullname AS referee
  FROM matches.fixtures mf
  JOIN gold.fact_fixture ff ON ff.fixture_id = mf.sportmonks_id
  LEFT JOIN master.teams lt ON lt.sportmonks_id = ff.localteam_id
  LEFT JOIN master.teams vt ON vt.sportmonks_id = ff.visitorteam_id
  LEFT JOIN master.officials u1 ON u1.sportmonks_id = mf.first_umpire_id
  LEFT JOIN master.officials u2 ON u2.sportmonks_id = mf.second_umpire_id
  LEFT JOIN master.officials u3 ON u3.sportmonks_id = mf.tv_umpire_id
  LEFT JOIN master.officials r ON r.sportmonks_id = mf.referee_id
  WHERE ff.season_id = 1795
    AND mf.first_umpire_id IS NOT NULL
  ORDER BY ff.date_key DESC
  LIMIT 2
`);
console.log('sample match officials', JSON.stringify(sampleMatch.rows, null, 2));

const leaderboard = await pool.query(`
  WITH roles AS (
    SELECT mf.sportmonks_id AS fixture_id, 'umpire' AS role, mf.first_umpire_id AS official_id
    FROM matches.fixtures mf
    UNION ALL
    SELECT mf.sportmonks_id, 'umpire', mf.second_umpire_id FROM matches.fixtures mf
    UNION ALL
    SELECT mf.sportmonks_id, 'tv_umpire', mf.tv_umpire_id FROM matches.fixtures mf
    UNION ALL
    SELECT mf.sportmonks_id, 'referee', mf.referee_id FROM matches.fixtures mf
  )
  SELECT o.fullname, r.role, COUNT(DISTINCT r.fixture_id)::int AS matches
  FROM roles r
  JOIN gold.fact_fixture ff ON ff.fixture_id = r.fixture_id
  JOIN master.officials o ON o.sportmonks_id = r.official_id
  WHERE ff.season_id = 1795 AND r.official_id IS NOT NULL
  GROUP BY o.fullname, r.role
  ORDER BY matches DESC
  LIMIT 5
`);
console.log('leaderboard sample', JSON.stringify(leaderboard.rows, null, 2));

await closePool();
