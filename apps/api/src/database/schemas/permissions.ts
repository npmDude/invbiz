import { pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const permissionsTable = pgTable('permissions', {
  id: varchar({ length: 255 }).primaryKey(),

  description: text().notNull(),
});
