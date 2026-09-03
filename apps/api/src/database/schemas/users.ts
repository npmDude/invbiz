import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  snakeCase,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { organizationsTable } from './organizations';

export const platformAccessEnum = pgEnum('platform_access', [
  'admin',
  'standard',
]);

export const usersTable = snakeCase.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id').references(
      () => organizationsTable.id,
      {
        onDelete: 'cascade',
      },
    ),

    name: varchar({ length: 255 }).notNull(),

    email: varchar({ length: 255 }).notNull().unique(),

    password: varchar({ length: 255 }).notNull(),

    platformAccess: platformAccessEnum().notNull().default('standard'),

    ...timestamps,
  },
  (table) => [
    index('users_organization_id_idx').on(table.organizationId),
    check(
      'users_organization_or_platform_admin_check',
      sql`(${table.organizationId} IS NOT NULL AND ${table.platformAccess} = 'standard')
       OR
       (${table.organizationId} IS NULL AND ${table.platformAccess} = 'admin')`,
    ),
  ],
);
