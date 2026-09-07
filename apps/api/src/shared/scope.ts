import createError from 'http-errors';

import type { AccessLevel } from '../database/schemas/users';

/** Minimal requester shape needed to resolve tenant scope. */
export type Requester = {
  id: string;
  organizationId: string | null;
  accessLevel: AccessLevel;
};

/** Tenant-scoped query filters. `userId` is only set for standard users. */
export type Scope = {
  organizationId: string;
  userId?: string;
};

export type ResolveScopeOptions = {
  /** When true, standard users are narrowed to their linked branches. */
  narrowBranches?: boolean;
};

/**
 * Resolve the tenant scope for a request.
 *
 * - Admins may access any organization; the requested value is used as-is.
 * - Standard users must request their own organization.
 * - With `narrowBranches`, `user` access level is limited to linked
 *   `users_branches` via `userId`; `admin` and `superuser` get no narrowing.
 */
export function resolveScope(
  requester: Requester,
  requestedOrganizationId: string,
  options?: ResolveScopeOptions,
): Scope {
  if (requester.accessLevel !== 'admin') {
    if (requester.organizationId !== requestedOrganizationId) {
      throw createError(403, 'Insufficient permissions.', {
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  }

  if (options?.narrowBranches && requester.accessLevel === 'user') {
    return { organizationId: requestedOrganizationId, userId: requester.id };
  }

  return { organizationId: requestedOrganizationId };
}
