import { and, eq, type SQL } from 'drizzle-orm';

import { db, type Database } from '../../database';
import { permissionsTable } from '../../database/schemas/permissions';
import { rolesPermissionsTable } from '../../database/schemas/roles-permissions';
import { usersTable, type User } from '../../database/schemas/users';
import { Service } from '../../shared/service';

export type UserFilters = {
  id?: string;
  email?: string;
  organizationId?: string;
};

export type SafeUser = Omit<User, 'password'>;

export type CreateUserInput = typeof usersTable.$inferInsert;

export function toSafeUser(user: User): SafeUser {
  const { password: _password, ...safeUser } = user;
  void _password;
  return safeUser;
}

export class UsersService extends Service<
  UserFilters,
  SafeUser,
  CreateUserInput
> {
  constructor(database: Database) {
    super({
      db: database,
      table: usersTable,
      resourceName: 'User',
    });
  }

  protected buildFilters(filters?: UserFilters): SQL | undefined {
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

  override async findAll(filters?: UserFilters): Promise<SafeUser[]> {
    const users = (await super.findAll(filters)) as unknown as User[];
    return users.map((user) => toSafeUser(user));
  }

  override async findOne(
    filters?: UserFilters,
    options?: { withPassword?: false },
  ): Promise<SafeUser | undefined>;
  override async findOne(
    filters: UserFilters | undefined,
    options: { withPassword: true },
  ): Promise<User | undefined>;
  override async findOne(
    filters?: UserFilters,
    options?: { withPassword?: boolean },
  ): Promise<SafeUser | User | undefined> {
    const user = (await super.findOne(filters)) as unknown as User | undefined;

    if (!user) {
      return undefined;
    }

    return options?.withPassword ? user : toSafeUser(user);
  }

  override async findById(id: string, scope?: UserFilters): Promise<SafeUser> {
    const user = (await super.findById(id, scope)) as unknown as User;
    return toSafeUser(user);
  }

  override async create(data: CreateUserInput): Promise<SafeUser> {
    const user = (await super.create(data)) as unknown as User;
    return toSafeUser(user);
  }

  override async update(
    id: string,
    data: Partial<CreateUserInput>,
    scope?: UserFilters,
  ): Promise<SafeUser> {
    const user = (await super.update(id, data, scope)) as unknown as User;
    return toSafeUser(user);
  }

  override async delete(id: string, scope?: UserFilters): Promise<SafeUser> {
    const user = (await super.delete(id, scope)) as unknown as User;
    return toSafeUser(user);
  }

  async findPermissionKeys(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        permission: permissionsTable.id,
      })
      .from(usersTable)
      .innerJoin(
        rolesPermissionsTable,
        eq(rolesPermissionsTable.roleId, usersTable.roleId),
      )
      .innerJoin(
        permissionsTable,
        eq(permissionsTable.id, rolesPermissionsTable.permissionId),
      )
      .where(eq(usersTable.id, userId));

    return rows.map((row) => row.permission);
  }
}

export const usersService = new UsersService(db);
