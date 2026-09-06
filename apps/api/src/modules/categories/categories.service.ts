import createError from 'http-errors';

import type {
  categoriesTable,
  Category,
} from '../../database/schemas/categories';
import { BaseService } from '../../shared/base.service';
import { throwConflictIfUniqueViolation } from '../../shared/unique-violation';
import {
  categoriesRepository,
  type CategoriesRepository,
  type CategoryFilters,
} from './categories.repository';

type CategoryCreate = typeof categoriesTable.$inferInsert;

export class CategoriesService extends BaseService<
  CategoryFilters,
  Category,
  CategoriesRepository
> {
  async create(data: CategoryCreate): Promise<Category> {
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

  async update(
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

    const parent = await this.repository.findById(parentId, {
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

      const ancestor = await this.repository.findById(ancestorParentId, {
        organizationId,
      });

      if (!ancestor) {
        break;
      }

      ancestorParentId = ancestor.parentId;
    }
  }
}

export const categoriesService = new CategoriesService(
  categoriesRepository,
  'Category',
);
