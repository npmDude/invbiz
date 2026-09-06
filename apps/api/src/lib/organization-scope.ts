import createError from 'http-errors';

import type { SafeUser } from '../modules/users/users.service';

/**
 * Resolve the organization scope for a request.
 *
 * The organization id is required on every scoped query (validated by the
 * query schema), so this helper only enforces tenant isolation:
 *
 * - Admins may access any organization; the requested value is used as-is.
 * - Standard users must request their own organization.
 */
export function resolveOrganizationScope(
  requester: SafeUser,
  requestedOrganizationId: string,
): string {
  if (requester.accessLevel === 'admin') {
    return requestedOrganizationId;
  }

  if (requester.organizationId !== requestedOrganizationId) {
    throw createError(403, 'Insufficient permissions.', {
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  return requestedOrganizationId;
}
