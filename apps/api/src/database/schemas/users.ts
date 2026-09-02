import {
  check,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { organizations } from './organizations';

export const platformAccess = pgEnum('platform_access', ['admin', 'standard']);

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),

    name: varchar({ length: 255 }).notNull(),

    email: varchar({ length: 255 }).notNull().unique(),

    password: varchar({ length: 255 }).notNull(),

    platformAccess: platformAccess().notNull().default('standard'),

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
  },
  (table) => [
    check(
      'users_organization_or_platform_admin_check',
      sql`(${table.organizationId} IS NOT NULL AND ${table.platformAccess} = 'standard')
       OR
       (${table.organizationId} IS NULL AND ${table.platformAccess} = 'admin')`,
    ),
  ],
);
