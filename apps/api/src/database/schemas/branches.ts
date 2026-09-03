import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { organizationsTable } from './organizations';

export const branchesTable = pgTable(
  'branches',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, {
        onDelete: 'cascade',
      }),

    name: varchar({ length: 255 }).notNull(),

    address: varchar({ length: 255 }).notNull(),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('branches_organization_id_name_idx').on(
      table.organizationId,
      table.name,
    ),
  ],
);
