import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { closePool, getPool } from '@cricket-ai/database';
import type pg from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  async query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    const pool = await getPool();
    return pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    await closePool();
  }
}
