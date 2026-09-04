import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usersTable } from './users';

export const refreshTokensTable = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    tokenHash: varchar('token_hash', { length: 255 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId)],
);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
