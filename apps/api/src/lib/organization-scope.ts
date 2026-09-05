import createError from 'http-errors';

import type { SafeUser } from '../modules/users/users.service';

/**
 * Resolve the organization scope for a request.
 *
 * - Admins have no limitations: the requested organization (if any) is used
 *   as-is, and an absent value means platform-wide access.
 * - Standard users must supply the organization id, it must match their own
 *   organization, and the matched value is returned for use as the service
 *   query filter.
 */
export function resolveOrganizationScope(
  requester: SafeUser,
  requestedOrganizationId?: string,
): string | undefined {
  if (requester.accessLevel === 'admin') {
    return requestedOrganizationId;
  }

  if (!requestedOrganizationId) {
    throw createError(400, 'An organization id is required.', {
      code: 'MISSING_ORGANIZATION_ID',
    });
  }

  if (requester.organizationId !== requestedOrganizationId) {
    throw createError(403, 'Insufficient permissions.', {
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  return requestedOrganizationId;
}
