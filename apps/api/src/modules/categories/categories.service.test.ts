import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../database';
import type { Category } from '../../database/schemas/categories';
import { Service } from '../../shared/service';
import { CategoriesService } from './categories.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const PARENT_ID = '44444444-4444-4444-8444-444444444444';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: CATEGORY_ID,
    organizationId: ORGANIZATION_ID,
    name: 'Test Category',
    parentId: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const service = new CategoriesService({} as Database);

  return {
    base: {
      findOne: vi.spyOn(Service.prototype, 'findOne'),
      findById: vi.spyOn(Service.prototype, 'findById'),
      create: vi.spyOn(Service.prototype, 'create'),
      update: vi.spyOn(Service.prototype, 'update'),
    },
    service,
  };
}

describe('CategoriesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a root category without a parent', async () => {
    const { base, service } = setup();
    const created = makeCategory();
    base.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: ORGANIZATION_ID,
      name: 'Root',
      parentId: null,
      order: 0,
    });

    expect(result).toBe(created);
    expect(base.findOne).not.toHaveBeenCalled();
  });

  it('should create a child category with a parent in the same organization', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(
      makeCategory({ id: PARENT_ID, parentId: null }),
    );
    const created = makeCategory({ parentId: PARENT_ID });
    base.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: ORGANIZATION_ID,
      name: 'Child',
      parentId: PARENT_ID,
      order: 1,
    });

    expect(result).toBe(created);
    expect(base.findOne).toHaveBeenCalledWith({
      id: PARENT_ID,
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should reject a parent from another organization', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(undefined);

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Child',
        parentId: PARENT_ID,
        order: 0,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Parent category not found in this organization.',
    });
  });

  it('should reject a category as its own parent', async () => {
    const { service } = setup();

    await expect(
      service.create({
        id: CATEGORY_ID,
        organizationId: ORGANIZATION_ID,
        name: 'Self',
        parentId: CATEGORY_ID,
        order: 0,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Category cannot be its own parent.',
    });
  });

  it('should reject a parent that is a descendant of the category', async () => {
    const { base, service } = setup();
    const childId = '55555555-5555-4555-8555-555555555555';
    // The category itself for the scope check in update.
    base.findById.mockResolvedValue(
      makeCategory({ id: CATEGORY_ID, parentId: null }),
    );
    // Parent's ancestor chain leads back to the category being updated.
    base.findOne.mockImplementation(async (filters) => {
      if (filters?.id === PARENT_ID) {
        return makeCategory({ id: PARENT_ID, parentId: childId });
      }
      if (filters?.id === childId) {
        return makeCategory({ id: childId, parentId: CATEGORY_ID });
      }
      return undefined;
    });

    await expect(
      service.update(
        CATEGORY_ID,
        { parentId: PARENT_ID },
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('should reject moving a category to another organization', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue(makeCategory());

    await expect(
      service.update(
        CATEGORY_ID,
        { organizationId: OTHER_ORGANIZATION_ID },
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Category cannot be moved to another organization.',
    });
  });

  it('should allow detaching a category to the root', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue(makeCategory({ parentId: PARENT_ID }));
    const updated = makeCategory({ parentId: null });
    base.update.mockResolvedValue(updated);

    const result = await service.update(
      CATEGORY_ID,
      { parentId: null },
      { organizationId: ORGANIZATION_ID },
    );

    expect(result).toBe(updated);
  });

  it('should map a duplicate name to 409 on create', async () => {
    const { base, service } = setup();
    base.create.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Duplicate',
        parentId: null,
        order: 0,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'A category with this name already exists in this organization.',
    });
  });

  it('should map a duplicate name to 409 on update', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue(makeCategory());
    base.update.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await expect(
      service.update(
        CATEGORY_ID,
        { name: 'Duplicate' },
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('should rethrow non-unique errors unchanged', async () => {
    const { base, service } = setup();
    const failure = new Error('Connection lost');
    base.create.mockRejectedValue(failure);

    await expect(
      service.create({
        organizationId: ORGANIZATION_ID,
        name: 'Unlucky',
        parentId: null,
        order: 0,
      }),
    ).rejects.toBe(failure);
  });
});
