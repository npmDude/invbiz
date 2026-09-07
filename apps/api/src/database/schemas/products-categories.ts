import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { categoriesTable } from './categories';
import { productsTable } from './products';

export const productsCategoriesTable = pgTable(
  'products_categories',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),

    categoryId: uuid('category_id')
      .notNull()
      .references(() => categoriesTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.categoryId],
    }),
    index('products_categories_category_id_idx').on(table.categoryId),
  ],
);
