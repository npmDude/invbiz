import { uuid, pgTable, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const platformAccess = pgEnum('platform_access', ['admin', 'standard']);

export const usersTable = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  platform_access: platformAccess().notNull().default('standard'),
});
