import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../database/schemas/users';
import type { UsersRepository } from './users.repository';
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

function setup() {
  const repository = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findPermissionKeys: vi.fn(),
  } as unknown as UsersRepository;

  const service = new UsersService(repository);

  return {
    repository: {
      findAll: vi.mocked(repository.findAll),
      findOne: vi.mocked(repository.findOne),
      findById: vi.mocked(repository.findById),
      create: vi.mocked(repository.create),
      update: vi.mocked(repository.update),
      delete: vi.mocked(repository.delete),
      findPermissionKeys: vi.mocked(repository.findPermissionKeys),
    },
    service,
  };
}

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should strip the password from findAll results', async () => {
    const { repository, service } = setup();
    repository.findAll.mockResolvedValue([makeUser()]);

    const users = await service.findAll();

    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty('password');
    expect(users[0]).toMatchObject({ id: userId });
  });

  it('should strip the password from findOne results by default', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne({ email: 'test@example.com' });

    expect(user).not.toHaveProperty('password');
  });

  it('should strip the password when withPassword is false', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne(
      { email: 'test@example.com' },
      { withPassword: false },
    );

    expect(user).not.toHaveProperty('password');
  });

  it('should return the full row including the hash with withPassword', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());

    const user = await service.findOne(
      { email: 'test@example.com' },
      { withPassword: true },
    );

    expect(user?.password).toBe('hashed-password');
    expect(repository.findOne).toHaveBeenCalledWith({
      email: 'test@example.com',
    });
  });

  it('should pass through an empty findOne result', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(undefined);

    await expect(
      service.findOne({ email: 'nobody@example.com' }),
    ).resolves.toBeUndefined();
  });

  it('should strip the password from findById results', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());

    const user = await service.findById(userId);

    expect(repository.findOne).toHaveBeenCalledWith({ id: userId });
    expect(user).not.toHaveProperty('password');
  });

  it('should scope findById to the organization when given', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(
      makeUser({ organizationId: 'org-123' }),
    );

    const user = await service.findById(userId, 'org-123');

    expect(repository.findOne).toHaveBeenCalledWith({
      id: userId,
      organizationId: 'org-123',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('should throw 404 from findById when the user is missing', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(undefined);

    await expect(service.findById(userId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should throw 404 from scoped findById outside the organization', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(undefined);

    await expect(service.findById(userId, 'other-org')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should strip the password from create results', async () => {
    const { repository, service } = setup();
    repository.create.mockResolvedValue(makeUser());

    const user = await service.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashed-password',
      accessLevel: 'user',
    });

    expect(user).not.toHaveProperty('password');
  });

  it('should strip the password from update results', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());
    repository.update.mockResolvedValue(makeUser({ name: 'Renamed' }));

    const user = await service.update(userId, { name: 'Renamed' });

    expect(repository.update).toHaveBeenCalledWith(userId, {
      name: 'Renamed',
    });
    expect(user).toMatchObject({ name: 'Renamed' });
    expect(user).not.toHaveProperty('password');
  });

  it('should read before writing within the organization scope', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(
      makeUser({ organizationId: 'org-123' }),
    );
    repository.update.mockResolvedValue(makeUser({ name: 'Renamed' }));

    await service.update(userId, { name: 'Renamed' }, 'org-123');

    expect(repository.findOne).toHaveBeenCalledWith({
      id: userId,
      organizationId: 'org-123',
    });
    expect(repository.update).toHaveBeenCalledWith(userId, {
      name: 'Renamed',
    });
  });

  it('should throw 404 from update without writing outside the scope', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(undefined);
    repository.update.mockResolvedValue(makeUser({ name: 'Renamed' }));

    await expect(
      service.update(userId, { name: 'Renamed' }, 'other-org'),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should throw 404 from update when the user is missing', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());
    repository.update.mockResolvedValue(undefined);

    await expect(
      service.update(userId, { name: 'Renamed' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('should strip the password from delete results', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());
    repository.delete.mockResolvedValue(makeUser());

    const user = await service.delete(userId);

    expect(repository.delete).toHaveBeenCalledWith(userId);
    expect(user).not.toHaveProperty('password');
  });

  it('should read before deleting within the organization scope', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(
      makeUser({ organizationId: 'org-123' }),
    );
    repository.delete.mockResolvedValue(makeUser());

    await service.delete(userId, 'org-123');

    expect(repository.findOne).toHaveBeenCalledWith({
      id: userId,
      organizationId: 'org-123',
    });
    expect(repository.delete).toHaveBeenCalledWith(userId);
  });

  it('should throw 404 from delete without deleting outside the scope', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(undefined);
    repository.delete.mockResolvedValue(makeUser());

    await expect(service.delete(userId, 'other-org')).rejects.toMatchObject({
      status: 404,
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('should throw 404 from delete when the user is missing', async () => {
    const { repository, service } = setup();
    repository.findOne.mockResolvedValue(makeUser());
    repository.delete.mockResolvedValue(undefined);

    await expect(service.delete(userId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('should delegate findPermissionKeys to the repository', async () => {
    const { repository, service } = setup();
    repository.findPermissionKeys.mockResolvedValue(['users.view']);

    await expect(service.findPermissionKeys(userId)).resolves.toEqual([
      'users.view',
    ]);
  });
});
