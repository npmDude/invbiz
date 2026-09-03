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

export const accessLevelEnum = pgEnum('access_level', [
  'platform_admin',
  'superuser',
  'user',
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

    accessLevel: accessLevelEnum().notNull().default('user'),

    ...timestamps,
  },
  (table) => [
    index('users_organization_id_idx').on(table.organizationId),
    check(
      'users_organization_access_check',
      sql`(
        ${table.accessLevel} = 'platform_admin'
        AND ${table.organizationId} IS NULL
      ) OR (
        ${table.accessLevel} IN ('superuser', 'user')
        AND ${table.organizationId} IS NOT NULL
      )`,
    ),
  ],
);
