import {
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { organizationsTable } from './organizations';

export const categoriesTable = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, {
        onDelete: 'cascade',
      }),

    name: varchar({ length: 255 }).notNull(),

    parentId: uuid('parent_id').references(
      (): AnyPgColumn => categoriesTable.id,
      {
        onDelete: 'cascade',
      },
    ),

    order: integer('order').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('categories_organization_id_name_idx').on(
      table.organizationId,
      table.name,
    ),
    index('categories_organization_id_idx').on(table.organizationId),
    index('categories_parent_id_idx').on(table.parentId),
  ],
);

export type Category = typeof categoriesTable.$inferSelect;
