import { index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { permissionsTable } from './permissions';
import { rolesTable } from './roles';

export const rolePermissionsTable = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'cascade' }),

    permissionId: varchar('permission_id', { length: 255 })
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
    }),
    index('role_permissions_permission_id_idx').on(table.permissionId),
  ],
);
