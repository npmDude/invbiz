import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { branchesTable } from './branches';
import { productsTable } from './products';

export const branchesProductsTable = pgTable(
  'branches_products',
  {
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branchesTable.id, {
        onDelete: 'cascade',
      }),

    productId: uuid('product_id')
      .notNull()
      .references(() => productsTable.id, {
        onDelete: 'cascade',
      }),

    quantity: integer('quantity').notNull().default(0),

    salePrice: numeric('sale_price', {
      precision: 12,
      scale: 2,
    }).notNull(),

    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.branchId, table.productId],
    }),
    index('branches_products_product_id_idx').on(table.productId),
    check('branches_products_quantity_check', sql`${table.quantity} >= 0`),
    check('branches_products_sale_price_check', sql`${table.salePrice} >= 0`),
  ],
);

export type BranchesProduct = typeof branchesProductsTable.$inferSelect;
