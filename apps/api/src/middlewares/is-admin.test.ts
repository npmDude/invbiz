import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../database/schemas/users';
import { isAdmin } from './is-admin';

function makeUser(overrides?: Partial<User>): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: null,
    name: 'Test Admin',
    email: 'admin@example.com',
    password: 'hashed',
    accessLevel: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

describe('isAdmin', () => {
  it('should reject a request without a user', () => {
    const { req, res, next } = setup();

    isAdmin(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('should call next for an admin', () => {
    const { req, res, next } = setup(makeUser());

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it('should reject a regular user with 403', () => {
    const { req, res, next } = setup(
      makeUser({
        accessLevel: 'user',
        organizationId: '11111111-1111-4111-8111-111111111111',
      }),
    );

    isAdmin(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  });

  it('should reject a superuser with 403', () => {
    const { req, res, next } = setup(
      makeUser({
        accessLevel: 'superuser',
        organizationId: '11111111-1111-4111-8111-111111111111',
      }),
    );

    isAdmin(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  });
});
