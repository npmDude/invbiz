import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { categoriesTable } from '../../database/schemas/categories';
import { BaseRepository } from '../../shared/base.repository';

export type CategoryFilters = {
  id?: string;
  organizationId?: string;
  parentId?: string | null;
};

export class CategoriesRepository extends BaseRepository<
  typeof categoriesTable,
  CategoryFilters
> {
  constructor(db: Database) {
    super(db, categoriesTable);
  }

  protected buildFilters(filters?: CategoryFilters) {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(categoriesTable.id, filters.id));
    }

    if (filters.organizationId) {
      conditions.push(
        eq(categoriesTable.organizationId, filters.organizationId),
      );
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(isNull(categoriesTable.parentId));
      } else {
        conditions.push(eq(categoriesTable.parentId, filters.parentId));
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

export const categoriesRepository = new CategoriesRepository(db);
