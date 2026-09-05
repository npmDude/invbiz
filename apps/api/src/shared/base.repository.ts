import {
  eq,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../database';

export interface Repository<TFilters, TResult, TCreate> {
  findOne(filters?: TFilters): Promise<TResult | undefined>;
  findAll(filters?: TFilters): Promise<TResult[]>;
  findById(id: string): Promise<TResult | undefined>;
  create(data: TCreate): Promise<TResult>;
  update(id: string, data: Partial<TCreate>): Promise<TResult | undefined>;
  delete(id: string): Promise<TResult | undefined>;
}

export abstract class BaseRepository<
  TTable extends PgTable & { id: AnyPgColumn },
  TFilters,
  TCreate = InferInsertModel<TTable>,
  TResult = InferSelectModel<TTable>,
> implements Repository<TFilters, TResult, TCreate> {
  constructor(
    protected readonly db: Database,
    protected readonly table: TTable,
  ) {}

  protected abstract buildFilters(filters?: TFilters): SQL | undefined;

  async findAll(filters?: TFilters): Promise<TResult[]> {
    return (
      this.db
        .select()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(this.table as any)
        .where(this.buildFilters(filters))
    );
  }

  async findOne(filters?: TFilters): Promise<TResult | undefined> {
    const [result] = await this.db
      .select()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(this.table as any)
      .where(this.buildFilters(filters))
      .limit(1);

    return result;
  }

  async findById(id: string): Promise<TResult | undefined> {
    const [record] = await this.db
      .select()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(this.table as any)
      .where(eq(this.table.id, id))
      .limit(1);

    return record;
  }

  async create(data: TCreate): Promise<TResult> {
    const rows = (await this.db
      .insert(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(data as any)
      .returning()) as unknown as TResult[];

    const row = rows[0];

    if (!row) {
      throw new Error('Failed to create record: no row returned');
    }

    return row;
  }

  async update(
    id: string,
    data: Partial<TCreate>,
  ): Promise<TResult | undefined> {
    if (Object.keys(data).length === 0) {
      return this.findById(id);
    }

    const [record] = (await this.db
      .update(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning()) as unknown as TResult[];

    return record;
  }

  async delete(id: string): Promise<TResult | undefined> {
    const [record] = (await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning()) as unknown as TResult[];

    return record;
  }
}
