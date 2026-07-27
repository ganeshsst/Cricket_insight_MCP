import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { closePool, getUsersPool } from '@cricket-ai/database';
import type pg from 'pg';

@Injectable()
export class UsersDatabaseService implements OnModuleDestroy {
  async query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    const pool = await getUsersPool();
    return pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    const name =
      process.env.USER_DATABASE_NAME ??
      process.env.USERS_DATABASE_NAME ??
      'users';
    await closePool(name);
  }
}
