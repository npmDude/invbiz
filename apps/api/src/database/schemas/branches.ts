import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizationsTable } from './organizations';

export const branchesTable = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),

  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizationsTable.id, {
      onDelete: 'cascade',
    }),

  name: varchar({ length: 255 }).notNull(),

  address: varchar({ length: 255 }).notNull(),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
