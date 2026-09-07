import { describe, expect, it } from 'vitest';

import type { Requester } from './scope';
import { resolveScope } from './scope';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequester(overrides?: Partial<Requester>): Requester {
  return {
    id: USER_ID,
    organizationId: ORGANIZATION_ID,
    accessLevel: 'user',
    ...overrides,
  };
}

describe('resolveScope', () => {
  it('should return the requested organization for an admin', () => {
    const admin = makeRequester({
      accessLevel: 'admin',
      organizationId: null,
    });

    expect(resolveScope(admin, OTHER_ORGANIZATION_ID)).toEqual({
      organizationId: OTHER_ORGANIZATION_ID,
    });
  });

  it('should return the matched organization for a member', () => {
    expect(resolveScope(makeRequester(), ORGANIZATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should throw 403 when a member requests another organization', () => {
    try {
      resolveScope(makeRequester(), OTHER_ORGANIZATION_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });

  it('should return the own organization without a user filter for a superuser', () => {
    const superuser = makeRequester({ accessLevel: 'superuser' });

    expect(
      resolveScope(superuser, ORGANIZATION_ID, { narrowBranches: true }),
    ).toEqual({
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should throw 403 when a superuser requests another organization', () => {
    const superuser = makeRequester({ accessLevel: 'superuser' });

    try {
      resolveScope(superuser, OTHER_ORGANIZATION_ID, { narrowBranches: true });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });

  it('should scope a standard user to their linked branches when narrowing', () => {
    expect(
      resolveScope(makeRequester(), ORGANIZATION_ID, { narrowBranches: true }),
    ).toEqual({
      organizationId: ORGANIZATION_ID,
      userId: USER_ID,
    });
  });

  it('should not narrow a standard user without the flag', () => {
    expect(resolveScope(makeRequester(), ORGANIZATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
    });
  });

  it('should throw 403 when a standard user requests another organization with narrowing', () => {
    try {
      resolveScope(makeRequester(), OTHER_ORGANIZATION_ID, {
        narrowBranches: true,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });
});
