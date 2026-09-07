import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../database';
import type { User } from '../../database/schemas/users';
import { Service } from '../../shared/service';
import { UsersService } from './users.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    organizationId: null,
    roleId: null,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function notFound() {
  return Object.assign(new Error('User not found.'), { status: 404 });
}

function setup() {
  const service = new UsersService({} as Database);

  return {
    base: {
      findAll: vi.spyOn(Service.prototype, 'findAll'),
      findOne: vi.spyOn(Service.prototype, 'findOne'),
      findById: vi.spyOn(Service.prototype, 'findById'),
      create: vi.spyOn(Service.prototype, 'create'),
      update: vi.spyOn(Service.prototype, 'update'),
      delete: vi.spyOn(Service.prototype, 'delete'),
    },
    service,
  };
}

describe('UsersService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should strip the password from findAll results', async () => {
    const { base, service } = setup();
    base.findAll.mockResolvedValue([makeUser()]);

    const users = await service.findAll();

    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty('password');
    expect(users[0]).toMatchObject({ id: userId });
  });

  it('should strip the password from findOne results by default', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne({ email: 'test@example.com' });

    expect(user).not.toHaveProperty('password');
  });

  it('should strip the password when withPassword is false', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne(
      { email: 'test@example.com' },
      { withPassword: false },
    );

    expect(user).not.toHaveProperty('password');
  });

  it('should return the full row including the hash with withPassword', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne(
      { email: 'test@example.com' },
      { withPassword: true },
    );

    expect(user?.password).toBe('hashed-password');
    expect(base.findOne).toHaveBeenCalledWith({
      email: 'test@example.com',
    });
  });

  it('should pass through an empty findOne result', async () => {
    const { base, service } = setup();
    base.findOne.mockResolvedValue(undefined);

    await expect(
      service.findOne({ email: 'nobody@example.com' }),
    ).resolves.toBeUndefined();
  });

  it('should strip the password from findById results', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue(makeUser());

    const user = await service.findById(userId);

    expect(base.findById).toHaveBeenCalledWith(userId, undefined);
    expect(user).not.toHaveProperty('password');
  });

  it('should scope findById to the organization when given', async () => {
    const { base, service } = setup();
    base.findById.mockResolvedValue(makeUser({ organizationId: 'org-123' }));

    const user = await service.findById(userId, { organizationId: 'org-123' });

    expect(base.findById).toHaveBeenCalledWith(userId, {
      organizationId: 'org-123',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('should throw 404 from findById when the user is missing', async () => {
    const { base, service } = setup();
    base.findById.mockRejectedValue(notFound());

    await expect(service.findById(userId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should throw 404 from scoped findById outside the organization', async () => {
    const { base, service } = setup();
    base.findById.mockRejectedValue(notFound());

    await expect(
      service.findById(userId, { organizationId: 'other-org' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should strip the password from create results', async () => {
    const { base, service } = setup();
    base.create.mockResolvedValue(makeUser());

    const user = await service.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashed-password',
      accessLevel: 'user',
    });

    expect(user).not.toHaveProperty('password');
  });

  it('should strip the password from update results', async () => {
    const { base, service } = setup();
    base.update.mockResolvedValue(makeUser({ name: 'Renamed' }));

    const user = await service.update(userId, { name: 'Renamed' });

    expect(base.update).toHaveBeenCalledWith(
      userId,
      { name: 'Renamed' },
      undefined,
    );
    expect(user).toMatchObject({ name: 'Renamed' });
    expect(user).not.toHaveProperty('password');
  });

  it('should write within the organization scope', async () => {
    const { base, service } = setup();
    base.update.mockResolvedValue(makeUser({ name: 'Renamed' }));

    await service.update(
      userId,
      { name: 'Renamed' },
      { organizationId: 'org-123' },
    );

    expect(base.update).toHaveBeenCalledWith(
      userId,
      { name: 'Renamed' },
      { organizationId: 'org-123' },
    );
  });

  it('should throw 404 from update outside the scope', async () => {
    const { base, service } = setup();
    base.update.mockRejectedValue(notFound());

    await expect(
      service.update(
        userId,
        { name: 'Renamed' },
        { organizationId: 'other-org' },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('should throw 404 from update when the user is missing', async () => {
    const { base, service } = setup();
    base.update.mockRejectedValue(notFound());

    await expect(
      service.update(userId, { name: 'Renamed' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('should strip the password from delete results', async () => {
    const { base, service } = setup();
    base.delete.mockResolvedValue(makeUser());

    const user = await service.delete(userId);

    expect(base.delete).toHaveBeenCalledWith(userId, undefined);
    expect(user).not.toHaveProperty('password');
  });

  it('should delete within the organization scope', async () => {
    const { base, service } = setup();
    base.delete.mockResolvedValue(makeUser());

    await service.delete(userId, { organizationId: 'org-123' });

    expect(base.delete).toHaveBeenCalledWith(userId, {
      organizationId: 'org-123',
    });
  });

  it('should throw 404 from delete outside the scope', async () => {
    const { base, service } = setup();
    base.delete.mockRejectedValue(notFound());

    await expect(
      service.delete(userId, { organizationId: 'other-org' }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should throw 404 from delete when the user is missing', async () => {
    const { base, service } = setup();
    base.delete.mockRejectedValue(notFound());

    await expect(service.delete(userId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should read permission keys through the query', async () => {
    const where = vi.fn().mockResolvedValue([{ permission: 'users.view' }]);
    const secondJoin = { where };
    const firstJoin = { innerJoin: vi.fn().mockReturnValue(secondJoin) };
    const fromResult = { innerJoin: vi.fn().mockReturnValue(firstJoin) };
    const fakeDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(fromResult),
      }),
    } as unknown as Database;

    const service = new UsersService(fakeDb);

    await expect(service.findPermissionKeys(userId)).resolves.toEqual([
      'users.view',
    ]);
    expect(where).toHaveBeenCalled();
  });
});
