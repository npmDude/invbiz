import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import createError from 'http-errors';

import { db, type Database } from '../../database';
import {
  categoriesTable,
  type Category,
} from '../../database/schemas/categories';
import { productsCategoriesTable } from '../../database/schemas/products-categories';
import { Service } from '../../shared/service';
import { throwConflictIfUniqueViolation } from '../../shared/unique-violation';

export type CategoryFilters = {
  id?: string;
  organizationId?: string;
  parentId?: string | null;
};

type CategoryCreate = typeof categoriesTable.$inferInsert;

export class CategoriesService extends Service<
  CategoryFilters,
  Category,
  CategoryCreate
> {
  constructor(database: Database) {
    super({
      db: database,
      table: categoriesTable,
      resourceName: 'Category',
    });
  }

  protected buildFilters(filters?: CategoryFilters): SQL | undefined {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(categoriesTable.id, filters.id));
    }

    if (filters.organizationId) {
      conditions.push(
        eq(categoriesTable.organizationId, filters.organizationId),
      );
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(isNull(categoriesTable.parentId));
      } else {
        conditions.push(eq(categoriesTable.parentId, filters.parentId));
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async create(data: CategoryCreate): Promise<Category> {
    await this.assertValidParent(data.organizationId, data.parentId, {
      id: data.id ?? undefined,
    });

    try {
      return await super.create(data);
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        'A category with this name already exists in this organization.',
      );
    }
  }

  override async update(
    id: string,
    data: Partial<CategoryCreate>,
    scope?: CategoryFilters,
  ): Promise<Category> {
    const current = await this.findById(id, scope);
    const organizationId = scope?.organizationId ?? current.organizationId;

    if (data.parentId !== undefined) {
      await this.assertValidParent(organizationId, data.parentId, { id });
    }

    if (data.organizationId !== undefined) {
      throw createError(
        400,
        'Category cannot be moved to another organization.',
      );
    }

    try {
      return await super.update(id, data, scope);
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        'A category with this name already exists in this organization.',
      );
    }
  }

  override async delete(
    id: string,
    scope?: CategoryFilters,
  ): Promise<Category> {
    const current = await this.findById(id, scope);
    const organizationId = scope?.organizationId ?? current.organizationId;

    await this.assertNoOrphanedProducts(organizationId, id);

    return super.delete(id, scope);
  }

  /**
   * Ensure a parent reference stays inside the same organization and cannot
   * introduce a cycle. A parent scoped to another organization is treated as
   * missing so cross-organization links can never be created.
   */
  private async assertValidParent(
    organizationId: string,
    parentId: string | null | undefined,
    current: { id?: string },
  ): Promise<void> {
    if (parentId === null || parentId === undefined) {
      return;
    }

    if (current.id !== undefined && parentId === current.id) {
      throw createError(400, 'Category cannot be its own parent.');
    }

    const parent = await this.findOne({
      id: parentId,
      organizationId,
    });

    if (!parent) {
      throw createError(400, 'Parent category not found in this organization.');
    }

    let ancestorParentId: string | null = parent.parentId;
    const visited = new Set([parent.id]);

    while (ancestorParentId !== null) {
      if (ancestorParentId === current.id) {
        throw createError(400, 'Category cannot be a descendant of itself.');
      }

      if (visited.has(ancestorParentId)) {
        throw createError(400, 'Category hierarchy contains a cycle.');
      }

      visited.add(ancestorParentId);

      const ancestor = await this.findOne({
        id: ancestorParentId,
        organizationId,
      });

      if (!ancestor) {
        break;
      }

      ancestorParentId = ancestor.parentId;
    }
  }

  /**
   * Reject deleting a category (and its cascading descendants) when any
   * product would be left without a category. Products require at least one
   * category, so the last link cannot be removed via category deletion.
   */
  private async assertNoOrphanedProducts(
    organizationId: string,
    categoryId: string,
  ): Promise<void> {
    const idsToDelete = await this.collectDescendantIds(
      organizationId,
      categoryId,
    );
    idsToDelete.push(categoryId);

    const linksToDelete = await this.db
      .select({
        productId: productsCategoriesTable.productId,
        categoryId: productsCategoriesTable.categoryId,
      })
      .from(productsCategoriesTable)
      .where(inArray(productsCategoriesTable.categoryId, idsToDelete));

    if (linksToDelete.length === 0) {
      return;
    }

    const affectedProductIds = [
      ...new Set(linksToDelete.map((link) => link.productId)),
    ];

    const allLinks = await this.db
      .select({ productId: productsCategoriesTable.productId })
      .from(productsCategoriesTable)
      .where(inArray(productsCategoriesTable.productId, affectedProductIds));

    const totalByProduct = countLinksByProduct(
      allLinks.map((link) => link.productId),
    );
    const deletedByProduct = countLinksByProduct(
      linksToDelete.map((link) => link.productId),
    );

    for (const productId of affectedProductIds) {
      if (
        (totalByProduct.get(productId) ?? 0) <=
        (deletedByProduct.get(productId) ?? 0)
      ) {
        throw createError(
          400,
          'Cannot delete category because one or more products would be left without a category.',
        );
      }
    }
  }

  private async collectDescendantIds(
    organizationId: string,
    parentId: string,
  ): Promise<string[]> {
    const collected: string[] = [];
    const queue: string[] = [parentId];
    const visited = new Set<string>([parentId]);

    while (queue.length > 0) {
      const current = queue.shift() as string;
      const children = await this.findAll({
        organizationId,
        parentId: current,
      });

      for (const child of children) {
        if (visited.has(child.id)) {
          continue;
        }
        visited.add(child.id);
        collected.push(child.id);
        queue.push(child.id);
      }
    }

    return collected;
  }
}

function countLinksByProduct(productIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const productId of productIds) {
    counts.set(productId, (counts.get(productId) ?? 0) + 1);
  }

  return counts;
}

export const categoriesService = new CategoriesService(db);
