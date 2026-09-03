import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { branchesTable } from './branches';
import { usersTable } from './users';

export const userBranchesTable = pgTable(
  'user_branches',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),

    branchId: uuid('branch_id')
      .notNull()
      .references(() => branchesTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.branchId],
    }),
    index('user_branches_branch_id_idx').on(table.branchId),
  ],
);
