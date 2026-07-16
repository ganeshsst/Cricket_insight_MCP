import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { databaseUrlFromEnv } from './env.js';

const secrets = new SecretsManagerClient({});

let pool: pg.Pool | undefined;

function stripQuotes(value: string | undefined): string | undefined {
  return value?.replace(/^"|"$/g, '');
}

function isRemoteHost(host: string | undefined): boolean {
  return Boolean(host && host !== 'localhost' && !host.startsWith('127.'));
}

async function resolvePoolConfig(): Promise<pg.PoolConfig> {
  const host = process.env.DATABASE_HOST;
  const databaseName = process.env.DATABASE_NAME;
  const user = stripQuotes(process.env.DATABASE_USER);
  const password = stripQuotes(process.env.DATABASE_PASSWORD);
  const port = Number(process.env.DATABASE_PORT ?? '5432');

  if (host && databaseName && user && password) {
    return {
      host,
      port,
      user,
      password,
      database: databaseName,
      ...(isRemoteHost(host)
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    };
  }

  const connectionString = await resolveDatabaseUrl();
  return {
    connectionString,
    ...(isRemoteHost(host) ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

async function resolveDatabaseUrl(): Promise<string> {
  const directUrl = stripQuotes(process.env.DATABASE_URL);
  if (directUrl) {
    return directUrl;
  }

  const secretArn = process.env.DATABASE_SECRET_ARN;
  const host = process.env.DATABASE_HOST;
  const databaseName = process.env.DATABASE_NAME;
  const port = process.env.DATABASE_PORT ?? '5432';

  if (secretArn && host && databaseName) {
    const username = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;

    if (username && password) {
      return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
    }

    const response = await secrets.send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );
    if (!response.SecretString) {
      throw new Error(`Secret ${secretArn} has no SecretString`);
    }

    const creds = JSON.parse(response.SecretString) as {
      username: string;
      password: string;
    };

    return `postgresql://${creds.username}:${creds.password}@${host}:${port}/${databaseName}`;
  }

  return databaseUrlFromEnv();
}

export async function getPool(): Promise<pg.Pool> {
  if (pool) {
    return pool;
  }

  pool = new pg.Pool(await resolvePoolConfig());
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
