import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';

export const organizationsTable = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),

  ...timestamps,
});
