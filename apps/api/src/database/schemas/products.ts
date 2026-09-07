import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';
import { organizationsTable } from './organizations';

export const productsTable = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, {
        onDelete: 'cascade',
      }),

    name: varchar({ length: 255 }).notNull(),

    code: varchar({ length: 64 }).notNull(),

    supplierPrice: numeric('supplier_price', {
      precision: 12,
      scale: 2,
    }).notNull(),

    description: text(),

    stockAlert: integer('stock_alert'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('products_organization_id_name_idx').on(
      table.organizationId,
      table.name,
    ),
    uniqueIndex('products_organization_id_code_idx').on(
      table.organizationId,
      table.code,
    ),
    index('products_organization_id_idx').on(table.organizationId),
    check('products_supplier_price_check', sql`${table.supplierPrice} >= 0`),
    check(
      'products_stock_alert_check',
      sql`${table.stockAlert} IS NULL OR ${table.stockAlert} >= 0`,
    ),
  ],
);

export type Product = typeof productsTable.$inferSelect;
