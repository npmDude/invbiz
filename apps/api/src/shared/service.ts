import {
  and,
  eq,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import createError from 'http-errors';

import type { Database } from '../database';

interface ServiceOptions {
  db: Database;
  table: PgTable & { id: AnyPgColumn };
  resourceName?: string;
}

export abstract class Service<
  TFilters,
  TResult = Record<string, unknown>,
  TCreate = Record<string, unknown>,
> {
  protected readonly db: Database;
  private readonly table: PgTable & { id: AnyPgColumn };
  private readonly resourceName: string;

  constructor({ db, table, resourceName = 'Record' }: ServiceOptions) {
    this.db = db;
    this.table = table;
    this.resourceName = resourceName;
  }

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

  async findById(id: string, scope?: TFilters): Promise<TResult> {
    const [record] = await this.db
      .select()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(this.table as any)
      .where(and(eq(this.table.id, id), this.buildFilters(scope)))
      .limit(1);

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

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
    scope?: TFilters,
  ): Promise<TResult> {
    if (Object.keys(data).length === 0) {
      return this.findById(id, scope);
    }

    const [record] = (await this.db
      .update(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(data as any)
      .where(and(eq(this.table.id, id), this.buildFilters(scope)))
      .returning()) as unknown as TResult[];

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

    return record;
  }

  async delete(id: string, scope?: TFilters): Promise<TResult> {
    const [record] = (await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), this.buildFilters(scope)))
      .returning()) as unknown as TResult[];

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

    return record;
  }
}

export type {
  InferInsertModel as InferCreateModel,
  InferSelectModel as InferResultModel,
};
