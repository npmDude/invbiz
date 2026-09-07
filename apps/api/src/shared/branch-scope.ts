import type { SafeUser } from '../modules/users/users.service';
import { resolveOrganizationScope } from './organization-scope';

/** Branch-scoped query filters. `userId` is only set for standard users. */
export type BranchScope = {
  organizationId: string;
  userId?: string;
};

/**
 * Resolve the branch scope. Delegates org isolation to
 * {@link resolveOrganizationScope}; `admin` and `superuser` get no branch
 * narrowing, `user` is limited to linked `users_branches`.
 */
export function resolveBranchScope(
  requester: SafeUser,
  requestedOrganizationId: string,
): BranchScope {
  const organizationId = resolveOrganizationScope(
    requester,
    requestedOrganizationId,
  );

  if (requester.accessLevel === 'user') {
    return { organizationId, userId: requester.id };
  }

  return { organizationId };
}
