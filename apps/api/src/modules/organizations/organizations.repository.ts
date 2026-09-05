import { and, eq, type SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { organizationsTable } from '../../database/schemas/organizations';
import { BaseRepository } from '../../shared/base.repository';

export type OrganizationFilters = {
  id?: string;
};

export class OrganizationsRepository extends BaseRepository<
  typeof organizationsTable,
  OrganizationFilters
> {
  constructor(db: Database) {
    super(db, organizationsTable);
  }

  protected buildFilters(filters?: OrganizationFilters) {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(organizationsTable.id, filters.id));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

export const organizationsRepository = new OrganizationsRepository(db);
