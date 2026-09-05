import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import createError from 'http-errors';

import type { User } from '../database/schemas/users';
import { signAccessToken } from '../modules/auth/auth.jwt';
import { usersService } from '../modules/users/users.service';
import { authenticate } from './authenticate';

vi.mock('../modules/users/users.service', () => ({
  usersService: { findById: vi.fn() },
}));

const findById = vi.mocked(usersService.findById);

const userId = '550e8400-e29b-41d4-a716-446655440000';

function makeUser(): User {
  return {
    id: userId,
    organizationId: null,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setup(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

function thrownError(next: ReturnType<typeof vi.fn>) {
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0] as { status?: number; code?: string };
}

describe('authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attach the live user for a valid token', async () => {
    const user = makeUser();
    findById.mockResolvedValue(user);
    const token = await signAccessToken(userId);
    const { req, res, next } = setup({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it('should reject a missing header with MISSING_ACCESS_TOKEN', async () => {
    const { req, res, next } = setup();

    await authenticate(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'MISSING_ACCESS_TOKEN',
    });
  });

  it('should reject a non-bearer header with MISSING_ACCESS_TOKEN', async () => {
    const { req, res, next } = setup({ authorization: 'Basic abc123' });

    await authenticate(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'MISSING_ACCESS_TOKEN',
    });
  });

  it('should reject an empty bearer token with MISSING_ACCESS_TOKEN', async () => {
    const { req, res, next } = setup({ authorization: 'Bearer   ' });

    await authenticate(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'MISSING_ACCESS_TOKEN',
    });
  });

  it('should reject a tampered token with INVALID_ACCESS_TOKEN', async () => {
    const token = await signAccessToken(userId);
    const { req, res, next } = setup({
      authorization: `Bearer ${token}tampered`,
    });

    await authenticate(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'INVALID_ACCESS_TOKEN',
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('should reject a valid token for a deleted user', async () => {
    findById.mockRejectedValue(createError(404, 'User not found.'));
    const token = await signAccessToken(userId);
    const { req, res, next } = setup({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(req.user).toBeUndefined();
    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'INVALID_ACCESS_TOKEN',
    });
  });
});
