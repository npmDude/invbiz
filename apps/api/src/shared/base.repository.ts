import { type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../database';

export abstract class BaseRepository<TTable extends PgTable, TFilters, TResult> {
  constructor(
    protected readonly db: Database,
    protected readonly table: TTable,
  ) {}

  protected abstract buildFilters(filters?: TFilters): SQL | undefined;

  async findOne(filters?: TFilters): Promise<TResult | undefined> {
    const [result] = await this.db
      .select()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(this.table as any)
      .where(this.buildFilters(filters))
      .limit(1);

    return result;
  }

  async findAll(filters?: TFilters): Promise<TResult[] | undefined> {
    return (
      this.db
        .select()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(this.table as any)
        .where(this.buildFilters(filters))
    );
  }
}
