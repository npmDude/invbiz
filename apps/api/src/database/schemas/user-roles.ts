import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { rolesTable } from './roles';
import { usersTable } from './users';

export const userRolesTable = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    roleId: uuid('role_id')
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.roleId],
    }),
    index('user_roles_role_id_idx').on(table.roleId),
  ],
);
