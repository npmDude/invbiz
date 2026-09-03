import { index, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { organizationsTable } from './organizations';

export const rolesTable = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, {
        onDelete: 'cascade',
      }),

    name: varchar({ length: 255 }).notNull(),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('roles_organization_id_name_idx').on(
      table.organizationId,
      table.name,
    ),
    index('roles_organization_id_idx').on(table.organizationId),
  ],
);
