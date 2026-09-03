import { and, eq, SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { usersTable, type User } from '../../database/schemas/users';
import { BaseRepository } from '../../shared/base.repository';

export type UserFilters = {
  id?: string;
  email?: string;
  organizationId?: string;
};

export class UsersRepository extends BaseRepository<
  typeof usersTable,
  UserFilters,
  User
> {
  constructor(db: Database) {
    super(db, usersTable);
  }

  protected buildFilters(filters?: UserFilters) {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(usersTable.id, filters.id));
    }

    if (filters.email) {
      conditions.push(eq(usersTable.email, filters.email));
    }

    if (filters.organizationId) {
      conditions.push(eq(usersTable.organizationId, filters.organizationId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

export const userRepository = new UsersRepository(db);
