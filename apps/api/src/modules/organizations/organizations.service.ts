import { and, eq, type SQL } from 'drizzle-orm';

import { db, type Database } from '../../database';
import {
  organizationsTable,
  type Organization,
} from '../../database/schemas/organizations';
import { Service } from '../../shared/service';

export type OrganizationFilters = {
  id?: string;
};

type OrganizationCreate = typeof organizationsTable.$inferInsert;

export class OrganizationsService extends Service<
  OrganizationFilters,
  Organization,
  OrganizationCreate
> {
  constructor(database: Database) {
    super({
      db: database,
      table: organizationsTable,
      resourceName: 'Organization',
    });
  }

  protected buildFilters(filters?: OrganizationFilters): SQL | undefined {
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

export const organizationsService = new OrganizationsService(db);
