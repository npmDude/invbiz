import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../database/schemas/users';
import { authService } from '../modules/auth/auth.service';
import { requirePermission } from './require-permission';

vi.mock('../modules/auth/auth.service', () => ({
  authService: { hasPermissions: vi.fn() },
}));

const hasPermissions = vi.mocked(authService.hasPermissions);

function makeUser(): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: null,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setup(user?: User) {
  const req = { user } as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

function thrownError(next: ReturnType<typeof vi.fn>) {
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0] as { status?: number; code?: string };
}

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject a request without a user', async () => {
    const { req, res, next } = setup();

    await requirePermission('things:read')(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(hasPermissions).not.toHaveBeenCalled();
  });

  it('should call next when the user is allowed', async () => {
    const user = makeUser();
    hasPermissions.mockResolvedValue(true);
    const { req, res, next } = setup(user);

    await requirePermission('things:read')(req, res, next);

    expect(hasPermissions).toHaveBeenCalledWith(user, ['things:read']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it('should pass multiple permissions through as an array', async () => {
    const user = makeUser();
    hasPermissions.mockResolvedValue(true);
    const { req, res, next } = setup(user);

    await requirePermission(['things:read', 'things:write'])(req, res, next);

    expect(hasPermissions).toHaveBeenCalledWith(user, [
      'things:read',
      'things:write',
    ]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should reject a forbidden user with 403', async () => {
    hasPermissions.mockResolvedValue(false);
    const { req, res, next } = setup(makeUser());

    await requirePermission('things:read')(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  });
});
