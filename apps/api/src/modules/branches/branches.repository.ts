import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { branchesTable } from '../../database/schemas/branches';
import { usersBranchesTable } from '../../database/schemas/users-branches';
import { BaseRepository } from '../../shared/base.repository';

export type BranchFilters = {
  id?: string;
  organizationId?: string;
  userId?: string;
};

export class BranchesRepository extends BaseRepository<
  typeof branchesTable,
  BranchFilters
> {
  constructor(db: Database) {
    super(db, branchesTable);
  }

  protected buildFilters(filters?: BranchFilters) {
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

export const branchesRepository = new BranchesRepository(db);
