import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Category } from '../../database/schemas/categories';
import type { CategoriesRepository } from './categories.repository';
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
  const repository = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as CategoriesRepository;

  const service = new CategoriesService(repository, 'Category');

  return {
    repository: {
      findAll: vi.mocked(repository.findAll),
      findOne: vi.mocked(repository.findOne),
      findById: vi.mocked(repository.findById),
      create: vi.mocked(repository.create),
      update: vi.mocked(repository.update),
      delete: vi.mocked(repository.delete),
    },
    service,
  };
}

describe('CategoriesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a root category without a parent', async () => {
    const { repository, service } = setup();
    const created = makeCategory();
    repository.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: ORGANIZATION_ID,
      name: 'Root',
      parentId: null,
      order: 0,
    });

    expect(result).toBe(created);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('should create a child category with a parent in the same organization', async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(
      makeCategory({ id: PARENT_ID, parentId: null }),
    );
    const created = makeCategory({ parentId: PARENT_ID });
    repository.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: ORGANIZATION_ID,
      name: 'Child',
      parentId: PARENT_ID,
      order: 1,
    });

    expect(result).toBe(created);
    expect(repository.findById).toHaveBeenCalledWith(PARENT_ID, {
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should reject a parent from another organization', async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(undefined);

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
    const { repository, service } = setup();
    const childId = '55555555-5555-4555-8555-555555555555';
    // Parent's ancestor chain leads back to the category being updated.
    repository.findById.mockImplementation(async (id: string) => {
      if (id === PARENT_ID) {
        return makeCategory({ id: PARENT_ID, parentId: childId });
      }
      if (id === childId) {
        return makeCategory({ id: childId, parentId: CATEGORY_ID });
      }
      return undefined;
    });
    // findById for the category itself (scope check in update).
    // findById for the category itself (scope check in update).
    const current = makeCategory({ id: CATEGORY_ID, parentId: null });
    repository.findById.mockImplementationOnce(async () => current);

    await expect(
      service.update(
        CATEGORY_ID,
        { parentId: PARENT_ID },
        { organizationId: ORGANIZATION_ID },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('should reject moving a category to another organization', async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(makeCategory());

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
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(
      makeCategory({ parentId: PARENT_ID }),
    );
    const updated = makeCategory({ parentId: null });
    repository.update.mockResolvedValue(updated);

    const result = await service.update(
      CATEGORY_ID,
      { parentId: null },
      { organizationId: ORGANIZATION_ID },
    );

    expect(result).toBe(updated);
  });

  it('should map a duplicate name to 409 on create', async () => {
    const { repository, service } = setup();
    repository.create.mockRejectedValue(
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
    const { repository, service } = setup();
    repository.findById.mockResolvedValue(makeCategory());
    repository.update.mockRejectedValue(
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
    const { repository, service } = setup();
    const failure = new Error('Connection lost');
    repository.create.mockRejectedValue(failure);

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
