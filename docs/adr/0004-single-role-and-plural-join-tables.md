# ADR-0004: Single Role per User and Plural Join-Table Names

- Status: Accepted
- Date: 2026-09-06
- Amends: ADR-0002, ADR-0003

## Context

ADR-0002 models user/role assignment with a `user_roles` many-to-many join
table, and names the many-to-many tables with a singular first segment
(`user_roles`, `user_branches`, `role_permissions`). In practice a standard
user holds at most one organization role, while `admin` and `superuser` users
hold no role at all (they bypass permission checks). The singular-first join
names are inconsistent with the plural base-table names (`users`, `roles`,
`branches`, `permissions`).

## Decision

1. Many-to-many join tables use `plural_plural` names derived from the base
   tables:
   - `user_branches` -> `users_branches`
   - `role_permissions` -> `roles_permissions`
2. The `user_roles` join table is removed. `users` gains a nullable
   `role_id` foreign key to `roles.id` (`ON DELETE SET NULL`), enforcing at
   most one role per user.
3. `admin` and `superuser` users must have `role_id IS NULL` (DB check
   `users_role_access_check`). Standard (`user`) rows may have one role or
   `NULL` (no permissions).
4. Permission lookup joins `users` -> `roles_permissions` -> `permissions`
   via `users.role_id` instead of the removed join table.
5. Organization consistency (`users.organization_id = roles.organization_id`)
   is enforced at the service layer, mirroring the branch-assignment rule in
   ADR-0003.

## Consequences

- Schema change requires a migration: rename the two join tables (data
  preserved), drop `user_roles` (existing assignments are not carried over),
  add `users.role_id` with index, FK, and check constraint.
- Assigning a role is a single-column update instead of a join-table insert;
  granting an additional permission reuses the user's existing role.
- ADR-0002 and ADR-0003 still show the old table names; they remain valid
  except for the naming and the `user_roles` model described here.
