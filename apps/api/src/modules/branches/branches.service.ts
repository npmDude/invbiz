import { and, eq, inArray, type SQL } from 'drizzle-orm';

import { db, type Database } from '../../database';
import { branchesTable, type Branch } from '../../database/schemas/branches';
import { usersBranchesTable } from '../../database/schemas/users-branches';
import { Service } from '../../shared/service';

export type BranchFilters = {
  id?: string;
  organizationId?: string;
  userId?: string;
};

type BranchCreate = typeof branchesTable.$inferInsert;

export class BranchesService extends Service<
  BranchFilters,
  Branch,
  BranchCreate
> {
  constructor(database: Database) {
    super({
      db: database,
      table: branchesTable,
      resourceName: 'Branch',
    });
  }

  protected buildFilters(filters?: BranchFilters): SQL | undefined {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(branchesTable.id, filters.id));
    }

    if (filters.organizationId) {
      conditions.push(eq(branchesTable.organizationId, filters.organizationId));
    }

    if (filters.userId) {
      conditions.push(
        inArray(
          branchesTable.id,
          this.db
            .select({ id: usersBranchesTable.branchId })
            .from(usersBranchesTable)
            .where(eq(usersBranchesTable.userId, filters.userId)),
        ),
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

export const branchesService = new BranchesService(db);
