import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../database';
import { branchesTable } from '../../database/schemas/branches';
import { branchesProductsTable } from '../../database/schemas/branches-products';
import type { Category } from '../../database/schemas/categories';
import type { Product } from '../../database/schemas/products';
import { Service } from '../../shared/service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from './products.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const CATEGORY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATEGORY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    organizationId: ORGANIZATION_ID,
    name: 'Test Product',
    code: 'TEST-001',
    supplierPrice: '10.50',
    description: null,
    stockAlert: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCategory(id: string): Category {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    name: `Category ${id.slice(0, 4)}`,
    parentId: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeBranch(id: string) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    name: `Branch ${id.slice(0, 4)}`,
    address: 'Addr',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function mockLookup(
  foundCategories: Category[],
  foundBranches: unknown[],
  foundPrices: unknown[],
) {
  const where = vi.fn().mockImplementation(() => {
    const table = from.mock.calls.at(-1)?.[0];
    if (table === branchesTable) {
      return Promise.resolve(foundBranches);
    }
    if (table === branchesProductsTable) {
      return Promise.resolve(foundPrices);
    }
    return Promise.resolve(foundCategories);
  });
  const from = vi.fn().mockReturnValue({ where });
  return { select: vi.fn().mockReturnValue({ from }), where, from };
}

function setup(
  options: {
    categories?: Category[];
    branches?: unknown[];
    prices?: unknown[];
  } = {},
) {
  const categories = options.categories ?? [makeCategory(CATEGORY_A)];
  const branches = options.branches ?? [makeBranch(BRANCH_A)];
  const prices = options.prices ?? [];
  const lookup = mockLookup(categories, branches, prices);

  const linksInsert = vi.fn().mockResolvedValue([]);
  const linksDelete = vi.fn().mockReturnValue({});
  const db = {
    select: lookup.select,
    insert: vi.fn().mockReturnValue({ values: linksInsert }),
    delete: vi.fn().mockReturnValue({ where: linksDelete }),
  } as unknown as Database & {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const service = new ProductsService(db);

  return {
    base: {
      findOne: vi.spyOn(Service.prototype, 'findOne'),
      findById: vi.spyOn(Service.prototype, 'findById'),
      findAll: vi.spyOn(Service.prototype, 'findAll'),
      create: vi.spyOn(Service.prototype, 'create'),
      update: vi.spyOn(Service.prototype, 'update'),
      delete: vi.spyOn(Service.prototype, 'delete'),
    },
    service,
    db,
    lookup,
    linksInsert,
  };
}

describe('ProductsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject creation without at least one category', async () => {
    const { service } = setup();

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '5.00',
        description: null,
        stockAlert: null,
        categoryIds: [],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Product must have at least one category.',
    });
  });

  it('should reject creation with a category from another organization', async () => {
    const { service } = setup({ categories: [] });

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '5.00',
        description: null,
        stockAlert: null,
        categoryIds: [CATEGORY_A],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'One or more categories were not found in this organization.',
    });
  });

  it('should create a product with validated categories', async () => {
    const { base, service, linksInsert } = setup({
      categories: [makeCategory(CATEGORY_A), makeCategory(CATEGORY_B)],
    });
    const created = makeProduct();
    base.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: ORGANIZATION_ID,
      name: 'Widget',
      code: 'W-001',
      supplierPrice: 10.5,
      description: null,
      stockAlert: null,
      categoryIds: [CATEGORY_A, CATEGORY_B],
      branchPrices: [{ branchId: BRANCH_A, salePrice: 2.5 }],
    });

    expect(result).toMatchObject({ id: PRODUCT_ID, name: 'Test Product' });
    expect(result.categoryIds).toEqual([CATEGORY_A, CATEGORY_B]);
    expect(result.branchPrices).toEqual([
      { branchId: BRANCH_A, quantity: 0, salePrice: '2.50' },
    ]);
    expect(base.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '10.50',
      }),
    );
    expect(linksInsert).toHaveBeenCalled();
  });

  it('should reject creation without at least one branch', async () => {
    const { service } = setup();

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '5.00',
        description: null,
        stockAlert: null,
        categoryIds: [CATEGORY_A],
        branchPrices: [],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Product must be available in at least one branch.',
    });
  });

  it('should reject creation with a branch from another organization', async () => {
    const { service } = setup({ branches: [] });

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '5.00',
        description: null,
        stockAlert: null,
        categoryIds: [CATEGORY_A],
        branchPrices: [{ branchId: BRANCH_A, salePrice: 2.5 }],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'One or more branches were not found in this organization.',
    });
  });

  it('should reject duplicate branches in branch prices', async () => {
    const { service } = setup();

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: '5.00',
        description: null,
        stockAlert: null,
        categoryIds: [CATEGORY_A],
        branchPrices: [
          { branchId: BRANCH_A, salePrice: 2.5 },
          { branchId: BRANCH_A, salePrice: 3 },
        ],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Duplicate branch in branch prices.',
    });
  });

  it('should narrow branch prices through the inventory service', async () => {
    const { base, service } = setup({
      prices: [
        {
          productId: PRODUCT_ID,
          branchId: BRANCH_A,
          quantity: 5,
          salePrice: '2.50',
        },
      ],
    });
    base.findAll.mockResolvedValue([makeProduct()]);
    const listForProducts = vi.spyOn(
      InventoryService.prototype,
      'listForProducts',
    );

    const result = await service.findAll({
      organizationId: ORGANIZATION_ID,
      userId: 'user-1',
    });

    expect(listForProducts).toHaveBeenCalledWith([PRODUCT_ID], {
      organizationId: ORGANIZATION_ID,
      userId: 'user-1',
    });
    expect(result).toMatchObject([
      {
        id: PRODUCT_ID,
        branchPrices: [{ branchId: BRANCH_A, quantity: 5 }],
      },
    ]);
  });

  it('should map a duplicate name or code to 409 on create', async () => {
    const { base, service } = setup();
    base.create.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Duplicate',
        code: 'DUP-001',
        supplierPrice: '1.00',
        description: null,
        stockAlert: null,
        categoryIds: [CATEGORY_A],
        branchPrices: [{ branchId: BRANCH_A, salePrice: 2.5 }],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('should reject moving a product to another organization', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue({
      ...makeProduct(),
      categoryIds: [CATEGORY_A],
      branchPrices: [],
    });

    await expect(
      service.update(
        PRODUCT_ID,
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
        } as never,
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Product cannot be moved to another organization.',
    });
  });

  it('should reject replacing categories with an empty list', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue({
      ...makeProduct(),
      categoryIds: [CATEGORY_A],
      branchPrices: [],
    });

    await expect(
      service.update(
        PRODUCT_ID,
        { categoryIds: [] },
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Product must have at least one category.',
    });
  });
});
