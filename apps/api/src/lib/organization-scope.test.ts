import { describe, expect, it } from 'vitest';

import type { SafeUser } from '../modules/users/users.service';
import { resolveOrganizationScope } from './organization-scope';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';

function makeUser(overrides?: Partial<SafeUser>): SafeUser {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: ORGANIZATION_ID,
    name: 'Test User',
    email: 'test@example.com',
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('resolveOrganizationScope', () => {
  it('should return the requested organization for an admin', () => {
    const admin = makeUser({ accessLevel: 'admin', organizationId: null });

    expect(resolveOrganizationScope(admin, OTHER_ORGANIZATION_ID)).toBe(
      OTHER_ORGANIZATION_ID,
    );
  });

  it('should return the matched organization for a member', () => {
    expect(resolveOrganizationScope(makeUser(), ORGANIZATION_ID)).toBe(
      ORGANIZATION_ID,
    );
  });

  it('should throw 403 when a member requests another organization', () => {
    try {
      resolveOrganizationScope(makeUser(), OTHER_ORGANIZATION_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  });
});
