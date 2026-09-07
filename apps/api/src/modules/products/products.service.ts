import { and, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import createError from 'http-errors';

import { db, type Database } from '../../database';
import { categoriesTable } from '../../database/schemas/categories';
import { productsTable, type Product } from '../../database/schemas/products';
import { productsCategoriesTable } from '../../database/schemas/products-categories';
import { Service } from '../../shared/service';
import { throwConflictIfUniqueViolation } from '../../shared/unique-violation';

export type ProductFilters = {
  id?: string;
  organizationId?: string;
  categoryId?: string;
  search?: string;
};

export type ProductWithCategories = Product & { categoryIds: string[] };

type ProductRow = typeof productsTable.$inferInsert;

export type ProductCreateInput = Omit<ProductRow, 'supplierPrice'> & {
  supplierPrice: string | number;
  categoryIds?: string[];
};

export type ProductUpdateInput = Omit<Partial<ProductRow>, 'supplierPrice'> & {
  supplierPrice?: string | number;
  categoryIds?: string[];
};

const CONFLICT_MESSAGE =
  'A product with this name or code already exists in this organization.';

function normalizePrice(value: string | number): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value;
}

export class ProductsService extends Service<
  ProductFilters,
  ProductWithCategories,
  ProductRow
> {
  constructor(database: Database) {
    super({
      db: database,
      table: productsTable,
      resourceName: 'Product',
    });
  }

  protected buildFilters(filters?: ProductFilters): SQL | undefined {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(productsTable.id, filters.id));
    }

    if (filters.organizationId) {
      conditions.push(eq(productsTable.organizationId, filters.organizationId));
    }

    if (filters.categoryId) {
      conditions.push(
        inArray(
          productsTable.id,
          this.db
            .select({ id: productsCategoriesTable.productId })
            .from(productsCategoriesTable)
            .where(eq(productsCategoriesTable.categoryId, filters.categoryId)),
        ),
      );
    }

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(productsTable.name, pattern),
          ilike(productsTable.code, pattern),
        ) as SQL,
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findAll(
    filters?: ProductFilters,
  ): Promise<ProductWithCategories[]> {
    const products = (await super.findAll(filters)) as unknown as Product[];

    if (products.length === 0) {
      return [];
    }

    const links = await this.listCategoryLinks(
      products.map((product) => product.id),
    );

    return products.map((product) => ({
      ...product,
      categoryIds: links.get(product.id) ?? [],
    }));
  }

  override async findOne(
    filters?: ProductFilters,
  ): Promise<ProductWithCategories | undefined> {
    const product = (await super.findOne(filters)) as unknown as
      Product | undefined;

    if (!product) {
      return undefined;
    }

    const links = await this.listCategoryLinks([product.id]);

    return { ...product, categoryIds: links.get(product.id) ?? [] };
  }

  override async findById(
    id: string,
    scope?: ProductFilters,
  ): Promise<ProductWithCategories> {
    const product = (await super.findById(id, scope)) as unknown as Product;
    const links = await this.listCategoryLinks([product.id]);

    return { ...product, categoryIds: links.get(product.id) ?? [] };
  }

  override async create(
    data: ProductCreateInput,
  ): Promise<ProductWithCategories> {
    const categoryIds = await this.assertValidCategories(
      data.organizationId,
      data.categoryIds ?? [],
    );

    const row: ProductRow = {
      organizationId: data.organizationId,
      name: data.name,
      code: data.code,
      supplierPrice: normalizePrice(data.supplierPrice),
      description: data.description ?? null,
      stockAlert: data.stockAlert ?? null,
    };

    let product: Product;
    try {
      product = (await super.create(row)) as unknown as Product;
    } catch (error) {
      throwConflictIfUniqueViolation(error, CONFLICT_MESSAGE);
    }

    await this.db.insert(productsCategoriesTable).values(
      categoryIds.map((categoryId) => ({
        productId: product.id,
        categoryId,
      })),
    );

    return { ...product, categoryIds };
  }

  override async update(
    id: string,
    data: ProductUpdateInput,
    scope?: ProductFilters,
  ): Promise<ProductWithCategories> {
    if (data.organizationId !== undefined) {
      throw createError(
        400,
        'Product cannot be moved to another organization.',
      );
    }

    const current = await this.findById(id, scope);
    const organizationId = scope?.organizationId ?? current.organizationId;

    const { categoryIds, supplierPrice, ...rest } = data;
    const row: Partial<ProductRow> = { ...rest };

    if (supplierPrice !== undefined) {
      row.supplierPrice = normalizePrice(supplierPrice);
    }

    let nextCategoryIds = current.categoryIds;

    if (categoryIds !== undefined) {
      nextCategoryIds = await this.assertValidCategories(
        organizationId,
        categoryIds,
      );
    }

    let product: Product = current;

    if (Object.keys(row).length > 0) {
      try {
        product = (await super.update(id, row, scope)) as unknown as Product;
      } catch (error) {
        throwConflictIfUniqueViolation(error, CONFLICT_MESSAGE);
      }
    }

    if (categoryIds !== undefined) {
      await this.db
        .delete(productsCategoriesTable)
        .where(eq(productsCategoriesTable.productId, id));
      await this.db
        .insert(productsCategoriesTable)
        .values(
          nextCategoryIds.map((categoryId) => ({ productId: id, categoryId })),
        );
    }

    return { ...product, categoryIds: nextCategoryIds };
  }

  override async delete(
    id: string,
    scope?: ProductFilters,
  ): Promise<ProductWithCategories> {
    const deleted = (await super.delete(id, scope)) as unknown as Product;

    return { ...deleted, categoryIds: [] };
  }

  private async assertValidCategories(
    organizationId: string,
    categoryIds: string[],
  ): Promise<string[]> {
    const deduped = [...new Set(categoryIds)];

    if (deduped.length === 0) {
      throw createError(400, 'Product must have at least one category.');
    }

    const matches = await this.db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.organizationId, organizationId),
          inArray(categoriesTable.id, deduped),
        ),
      );

    if (matches.length !== deduped.length) {
      throw createError(
        400,
        'One or more categories were not found in this organization.',
      );
    }

    return deduped;
  }

  private async listCategoryLinks(
    productIds: string[],
  ): Promise<Map<string, string[]>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        productId: productsCategoriesTable.productId,
        categoryId: productsCategoriesTable.categoryId,
      })
      .from(productsCategoriesTable)
      .where(inArray(productsCategoriesTable.productId, productIds));

    const grouped = new Map<string, string[]>();

    for (const row of rows as { productId: string; categoryId: string }[]) {
      const list = grouped.get(row.productId) ?? [];
      list.push(row.categoryId);
      grouped.set(row.productId, list);
    }

    return grouped;
  }
}

export const productsService = new ProductsService(db);
