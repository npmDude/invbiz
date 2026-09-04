import { and, eq, SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { permissionsTable } from '../../database/schemas/permissions';
import { rolePermissionsTable } from '../../database/schemas/role-permissions';
import { userRolesTable } from '../../database/schemas/user-roles';
import { usersTable } from '../../database/schemas/users';
import { BaseRepository } from '../../shared/base.repository';

export type UserFilters = {
  id?: string;
  email?: string;
  organizationId?: string;
};

export class UsersRepository extends BaseRepository<
  typeof usersTable,
  UserFilters
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

  async findPermissionKeys(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        permission: permissionsTable.id,
      })
      .from(userRolesTable)
      .innerJoin(
        rolePermissionsTable,
        eq(rolePermissionsTable.roleId, userRolesTable.roleId),
      )
      .innerJoin(
        permissionsTable,
        eq(permissionsTable.id, rolePermissionsTable.permissionId),
      )
      .where(eq(userRolesTable.userId, userId));

    return rows.map((row) => row.permission);
  }
}

export const usersRepository = new UsersRepository(db);
