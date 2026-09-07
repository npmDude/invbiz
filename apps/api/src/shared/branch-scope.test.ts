import { describe, expect, it } from 'vitest';

import type { SafeUser } from '../modules/users/users.service';
import { resolveBranchScope } from './branch-scope';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeUser(overrides?: Partial<SafeUser>): SafeUser {
  return {
    id: USER_ID,
    organizationId: ORGANIZATION_ID,
    roleId: null,
    name: 'Test User',
    email: 'test@example.com',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('resolveBranchScope', () => {
  it('should return the requested organization without a user filter for an admin', () => {
    const admin = makeUser({ accessLevel: 'admin', organizationId: null });

    expect(resolveBranchScope(admin, OTHER_ORGANIZATION_ID)).toEqual({
      organizationId: OTHER_ORGANIZATION_ID,
    });
  });

  it('should return the own organization without a user filter for a superuser', () => {
    const superuser = makeUser({ accessLevel: 'superuser' });

    expect(resolveBranchScope(superuser, ORGANIZATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should throw 403 when a superuser requests another organization', () => {
    const superuser = makeUser({ accessLevel: 'superuser' });

    try {
      resolveBranchScope(superuser, OTHER_ORGANIZATION_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });

  it('should scope a standard user to their linked branches', () => {
    expect(resolveBranchScope(makeUser(), ORGANIZATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
      userId: USER_ID,
    });
  });

  it('should throw 403 when a standard user requests another organization', () => {
    try {
      resolveBranchScope(makeUser(), OTHER_ORGANIZATION_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });
});
