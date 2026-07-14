import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const host = process.env.DATABASE_HOST;
const user = process.env.DATABASE_USER;
const password = process.env.DATABASE_PASSWORD;
const database = process.env.DATABASE_NAME;
const envPort = process.env.DATABASE_PORT;

async function tryConnect(label, port) {
  const client = new pg.Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    const schemas = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('master','matches','gold') ORDER BY 1",
    );
    const tables = await client.query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('master','matches','gold') AND table_type IN ('BASE TABLE','VIEW') ORDER BY 1,2 LIMIT 20",
    );
    console.log(`SUCCESS|${label}|port=${port}`);
    console.log(`schemas=${schemas.rows.map((r) => r.schema_name).join(',') || 'none'}`);
    console.log(
      `sample_objects=${tables.rows.map((r) => `${r.table_schema}.${r.table_name}`).join(';') || 'none'}`,
    );
    await client.end();
    return true;
  } catch (err) {
    console.log(`FAIL|${label}|port=${port}|${err.message.split('\n')[0]}`);
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

console.log(`host=${host}`);
console.log(`database=${database}`);
console.log(`user=${user}`);
console.log(`env_port=${envPort}`);
console.log(
  `database_url_stale=${process.env.DATABASE_URL?.includes('localhost') ? 'yes' : 'no'}`,
);

const ports = [...new Set([5432, Number(envPort)].filter(Boolean))];
let anySuccess = false;
for (const port of ports) {
  if (await tryConnect('direct', port)) {
    anySuccess = true;
  }
}

process.exit(anySuccess ? 0 : 1);
