import { and, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import createError from 'http-errors';

import { db, type Database } from '../../database';
import { branchesTable } from '../../database/schemas/branches';
import {
  branchesProductsTable,
  type BranchesProduct,
} from '../../database/schemas/branches-products';
import { productsTable } from '../../database/schemas/products';
import { usersBranchesTable } from '../../database/schemas/users-branches';
import { normalizePrice } from '../../shared/normalize-price';
import { throwConflictIfUniqueViolation } from '../../shared/unique-violation';

export type InventoryFilters = {
  organizationId: string;
  branchId?: string;
  productId?: string;
  search?: string;
  /** Set for standard users: narrow to assigned branches. */
  userId?: string;
};

export type InventoryRow = BranchesProduct & {
  productName: string;
  productCode: string;
};

export type InventoryPriceRow = Pick<
  BranchesProduct,
  'productId' | 'branchId' | 'quantity' | 'salePrice'
>;

export class InventoryService {
  constructor(private readonly database: Database) {}

  async create(input: {
    organizationId: string;
    branchId: string;
    productId: string;
    salePrice: string | number;
    quantity: number;
    userId?: string;
  }): Promise<BranchesProduct> {
    await this.assertBranchInOrganization(input.branchId, input.organizationId);
    await this.assertProductInOrganization(
      input.productId,
      input.organizationId,
    );

    if (input.userId) {
      await this.assertBranchAssignment(input.userId, input.branchId);
    }

    try {
      const [created] = (await this.database
        .insert(branchesProductsTable)
        .values({
          branchId: input.branchId,
          productId: input.productId,
          quantity: input.quantity,
          salePrice: normalizePrice(input.salePrice),
        })
        .returning()) as BranchesProduct[];

      if (!created) {
        throw createError(500, 'Failed to create inventory.');
      }

      return created;
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        'Inventory already exists for this branch and product.',
      );
    }
  }

  /**
   * List price rows for a batch of products, scoped to an organization and,
   * for standard users, narrowed to assigned branches.
   */
  async listForProducts(
    productIds: string[],
    scope: { organizationId?: string; userId?: string },
  ): Promise<InventoryPriceRow[]> {
    if (productIds.length === 0) {
      return [];
    }

    const conditions: SQL[] = [
      inArray(branchesProductsTable.productId, productIds),
    ];

    if (scope.organizationId !== undefined) {
      conditions.push(
        inArray(
          branchesProductsTable.branchId,
          this.database
            .select({ id: branchesTable.id })
            .from(branchesTable)
            .where(eq(branchesTable.organizationId, scope.organizationId)),
        ),
      );
    }

    if (scope.userId !== undefined) {
      conditions.push(
        inArray(
          branchesProductsTable.branchId,
          this.database
            .select({ branchId: usersBranchesTable.branchId })
            .from(usersBranchesTable)
            .where(eq(usersBranchesTable.userId, scope.userId)),
        ),
      );
    }

    return this.database
      .select({
        productId: branchesProductsTable.productId,
        branchId: branchesProductsTable.branchId,
        quantity: branchesProductsTable.quantity,
        salePrice: branchesProductsTable.salePrice,
      })
      .from(branchesProductsTable)
      .where(and(...conditions));
  }

  async findAll(filters: InventoryFilters): Promise<InventoryRow[]> {
    const conditions: SQL[] = [
      eq(branchesTable.organizationId, filters.organizationId),
    ];

    if (filters.branchId) {
      await this.assertBranchInOrganization(
        filters.branchId,
        filters.organizationId,
      );

      if (filters.userId) {
        await this.assertBranchAssignment(filters.userId, filters.branchId);
      }

      conditions.push(eq(branchesProductsTable.branchId, filters.branchId));
    } else if (filters.userId) {
      conditions.push(
        inArray(
          branchesProductsTable.branchId,
          this.database
            .select({ branchId: usersBranchesTable.branchId })
            .from(usersBranchesTable)
            .where(eq(usersBranchesTable.userId, filters.userId)),
        ),
      );
    }

    if (filters.productId) {
      conditions.push(eq(branchesProductsTable.productId, filters.productId));
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

    const rows = await this.database
      .select({
        branchId: branchesProductsTable.branchId,
        productId: branchesProductsTable.productId,
        quantity: branchesProductsTable.quantity,
        salePrice: branchesProductsTable.salePrice,
        createdAt: branchesProductsTable.createdAt,
        updatedAt: branchesProductsTable.updatedAt,
        productName: productsTable.name,
        productCode: productsTable.code,
      })
      .from(branchesProductsTable)
      .innerJoin(
        branchesTable,
        eq(branchesProductsTable.branchId, branchesTable.id),
      )
      .innerJoin(
        productsTable,
        eq(branchesProductsTable.productId, productsTable.id),
      )
      .where(and(...conditions));

    return rows as InventoryRow[];
  }

  async updateSalePrice(
    branchId: string,
    productId: string,
    salePrice: string | number,
    scope: { organizationId: string; userId?: string },
  ): Promise<BranchesProduct> {
    await this.assertBranchInOrganization(branchId, scope.organizationId);

    if (scope.userId) {
      await this.assertBranchAssignment(scope.userId, branchId);
    }

    const [updated] = (await this.database
      .update(branchesProductsTable)
      .set({ salePrice: normalizePrice(salePrice), updatedAt: new Date() })
      .where(
        and(
          eq(branchesProductsTable.branchId, branchId),
          eq(branchesProductsTable.productId, productId),
        ),
      )
      .returning()) as BranchesProduct[];

    if (!updated) {
      throw createError(404, 'Inventory not found.');
    }

    return updated;
  }

  private async assertBranchInOrganization(
    branchId: string,
    organizationId: string,
  ): Promise<void> {
    const [branch] = await this.database
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(
        and(
          eq(branchesTable.id, branchId),
          eq(branchesTable.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!branch) {
      throw createError(404, 'Branch not found in this organization.');
    }
  }

  private async assertProductInOrganization(
    productId: string,
    organizationId: string,
  ): Promise<void> {
    const [product] = await this.database
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!product) {
      throw createError(404, 'Product not found in this organization.');
    }
  }

  private async assertBranchAssignment(
    userId: string,
    branchId: string,
  ): Promise<void> {
    const [assignment] = await this.database
      .select({ branchId: usersBranchesTable.branchId })
      .from(usersBranchesTable)
      .where(
        and(
          eq(usersBranchesTable.userId, userId),
          eq(usersBranchesTable.branchId, branchId),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw createError(403, 'Insufficient permissions.', {
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  }
}

export const inventoryService = new InventoryService(db);
