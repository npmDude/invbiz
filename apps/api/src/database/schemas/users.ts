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
import { rolesTable } from './roles';

export const accessLevelEnum = pgEnum('access_level', [
  'admin',
  'superuser',
  'user',
]);

export type AccessLevel = (typeof accessLevelEnum.enumValues)[number];

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

    roleId: uuid('role_id').references(() => rolesTable.id, {
      onDelete: 'set null',
    }),

    ...timestamps,
  },
  (table) => [
    index('users_organization_id_idx').on(table.organizationId),
    index('users_role_id_idx').on(table.roleId),
    check(
      'users_organization_access_check',
      sql`(
        ${table.accessLevel} = 'admin'
        AND ${table.organizationId} IS NULL
      ) OR (
        ${table.accessLevel} IN ('superuser', 'user')
        AND ${table.organizationId} IS NOT NULL
      )`,
    ),
    check(
      'users_role_access_check',
      sql`(
        ${table.accessLevel} IN ('admin', 'superuser')
        AND ${table.roleId} IS NULL
      ) OR (
        ${table.accessLevel} = 'user'
      )`,
    ),
  ],
);

export type User = typeof usersTable.$inferSelect;
