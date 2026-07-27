import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { databaseUrlFromEnv } from './env.js';

const secrets = new SecretsManagerClient({});

const pools = new Map<string, pg.Pool>();

function stripQuotes(value: string | undefined): string | undefined {
  return value?.replace(/^"|"$/g, '');
}

function isRemoteHost(host: string | undefined): boolean {
  return Boolean(host && host !== 'localhost' && !host.startsWith('127.'));
}

/**
 * pg v8 treats sslmode=require as verify-full, which fails on Aurora
 * ("unable to get local issuer certificate"). Strip sslmode from the URL
 * and always pass an explicit ssl config for remote hosts.
 */
function relaxSsl(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('uselibpqcompat');
    return u.toString();
  } catch {
    return connectionString;
  }
}

function withRemoteSsl(config: pg.PoolConfig, remote: boolean): pg.PoolConfig {
  if (!remote) return config;
  return {
    ...config,
    ...(config.connectionString
      ? { connectionString: relaxSsl(config.connectionString) }
      : {}),
    ssl: { rejectUnauthorized: false },
  };
}

function usersDatabaseName(): string {
  return (
    process.env.USER_DATABASE_NAME ??
    process.env.USERS_DATABASE_NAME ??
    'users'
  );
}

async function resolvePoolConfig(
  databaseOverride?: string,
): Promise<pg.PoolConfig> {
  // Prefer dedicated URL only when targeting the chat/history database.
  if (databaseOverride && databaseOverride === usersDatabaseName()) {
    const usersUrl = stripQuotes(
      process.env.USERS_DATABASE_URL ?? process.env.USER_DATABASE_URL,
    );
    if (usersUrl) {
      return withRemoteSsl({ connectionString: usersUrl }, true);
    }
  }

  const host = process.env.DATABASE_HOST;
  const databaseName = databaseOverride ?? process.env.DATABASE_NAME;
  const user = stripQuotes(process.env.DATABASE_USER);
  const password = stripQuotes(process.env.DATABASE_PASSWORD);
  const port = Number(process.env.DATABASE_PORT ?? '5432');

  if (host && databaseName && user && password) {
    return withRemoteSsl(
      {
        host,
        port,
        user,
        password,
        database: databaseName,
      },
      isRemoteHost(host),
    );
  }

  const connectionString = await resolveDatabaseUrl(databaseOverride);
  return withRemoteSsl(
    { connectionString },
    isRemoteHost(host) || Boolean(databaseOverride),
  );
}

async function resolveDatabaseUrl(databaseOverride?: string): Promise<string> {
  if (databaseOverride && databaseOverride === usersDatabaseName()) {
    const usersUrl = stripQuotes(
      process.env.USERS_DATABASE_URL ?? process.env.USER_DATABASE_URL,
    );
    if (usersUrl) {
      return usersUrl;
    }
  }

  const directUrl = stripQuotes(process.env.DATABASE_URL);
  if (directUrl && !databaseOverride) {
    return directUrl;
  }

  if (directUrl && databaseOverride) {
    try {
      const u = new URL(directUrl);
      u.pathname = `/${databaseOverride}`;
      return u.toString();
    } catch {
      /* fall through */
    }
  }

  const secretArn = process.env.DATABASE_SECRET_ARN;
  const host = process.env.DATABASE_HOST;
  const databaseName = databaseOverride ?? process.env.DATABASE_NAME;
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

function poolKey(database?: string): string {
  return database ?? process.env.DATABASE_NAME ?? 'default';
}

export async function getPool(database?: string): Promise<pg.Pool> {
  const key = poolKey(database);
  let pool = pools.get(key);
  if (pool) {
    return pool;
  }

  pool = new pg.Pool(await resolvePoolConfig(database));
  pools.set(key, pool);
  return pool;
}

/** Aurora logical DB for Auth0 profiles + chat history. */
export function getUsersPool(): Promise<pg.Pool> {
  return getPool(usersDatabaseName());
}

export async function closePool(database?: string): Promise<void> {
  if (database) {
    const key = poolKey(database);
    const pool = pools.get(key);
    if (pool) {
      await pool.end();
      pools.delete(key);
    }
    return;
  }

  await Promise.all([...pools.values()].map((p) => p.end()));
  pools.clear();
}
