import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../database/schemas/users';
import { requireOrganizationMembership } from './require-organization-membership';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';

function makeUser(overrides?: Partial<User>): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: ORGANIZATION_ID,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(
  user?: User,
  params: Record<string, string> = {},
  query: Record<string, unknown> = {},
) {
  const req = { user, params, query } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

function thrownError(next: ReturnType<typeof vi.fn>) {
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0] as { status?: number; code?: string };
}

function expectAllowed(next: ReturnType<typeof vi.fn>) {
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0]).toEqual([]);
}

describe('requireOrganizationMembership', () => {
  it('should reject a request without a user', () => {
    const { req, res, next } = setup();

    requireOrganizationMembership()(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('should allow an admin regardless of organization', () => {
    const { req, res, next } = setup(
      makeUser({ accessLevel: 'admin', organizationId: null }),
      { id: OTHER_ORGANIZATION_ID },
    );

    requireOrganizationMembership('params')(req, res, next);

    expectAllowed(next);
  });

  it('should allow a member through the id route parameter', () => {
    const { req, res, next } = setup(makeUser(), {
      id: ORGANIZATION_ID,
    });

    requireOrganizationMembership('params')(req, res, next);

    expectAllowed(next);
  });

  it('should ignore the query parameter when reading from params', () => {
    const { req, res, next } = setup(
      makeUser(),
      { id: ORGANIZATION_ID },
      { organizationId: OTHER_ORGANIZATION_ID },
    );

    requireOrganizationMembership('params')(req, res, next);

    expectAllowed(next);
  });

  it('should allow a member through the organizationId query parameter', () => {
    const { req, res, next } = setup(
      makeUser(),
      {},
      { organizationId: ORGANIZATION_ID },
    );

    requireOrganizationMembership()(req, res, next);

    expectAllowed(next);
  });

  it('should ignore route parameters when reading from the query', () => {
    const { req, res, next } = setup(
      makeUser(),
      { id: OTHER_ORGANIZATION_ID },
      { organizationId: ORGANIZATION_ID },
    );

    requireOrganizationMembership()(req, res, next);

    expectAllowed(next);
  });

  it('should reject a request without an organization id', () => {
    const { req, res, next } = setup(makeUser());

    requireOrganizationMembership()(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 400,
      code: 'MISSING_ORGANIZATION_ID',
    });
  });

  it('should reject a user that does not belong to the organization', () => {
    const { req, res, next } = setup(
      makeUser(),
      {},
      { organizationId: OTHER_ORGANIZATION_ID },
    );

    requireOrganizationMembership()(req, res, next);

    expect(thrownError(next)).toMatchObject({
      status: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  });
});
