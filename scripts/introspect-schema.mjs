import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const objects = [
  'master.players',
  'master.teams',
  'gold.dim_player',
  'gold.fact_batting',
  'gold.fact_bowling',
  'gold.fact_fixture',
  'matches.fixtures',
  'matches.fixture_runs',
];

await client.connect();

for (const obj of objects) {
  const [schema, name] = obj.split('.');
  const cols = await client.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, name],
  );
  console.log(`\n=== ${obj} ===`);
  for (const row of cols.rows) {
    console.log(`${row.column_name}\t${row.data_type}`);
  }
}

const samplePlayer = await client.query(
  `SELECT sportmonks_id, fullname, firstname, lastname FROM master.players LIMIT 3`,
);
console.log('\n=== sample players ===');
console.log(JSON.stringify(samplePlayer.rows, null, 2));

await client.end();
