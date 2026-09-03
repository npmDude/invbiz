# ADR 0001: Authorization Model

- Status: Deprecated
- Superseded by: ADR 0002
- Date: 2026-09-03

## Context

InvBiz data belongs to organizations. A user can belong to many organizations and must only access data in an organization for which they have authorization. Organizations also need configurable permissions without allowing their users to change privileged system access.

## Decision

Authorization has three distinct access paths:

- A user with `platform_access = admin` has global platform access. This is reserved for internal administrators, including development accounts, and is not assigned through an organization role.
- An organization membership with `access_level = superuser` has every permission in that organization. It does not grant access to other organizations and is not an organization role.
- A standard organization membership receives permissions from zero or more configurable organization roles.

Users and organizations have a many-to-many relationship through organization memberships. Roles, their permissions, and their assignments belong to one organization.

Permissions use `<domain>.<action>` identifiers. The initial action set for every domain is:

- `view` for reading records.
- `create` for creating records.
- `manage` for updating and deleting records.

`manage` may be split into narrower actions only when a product requirement requires it.

For an organization-scoped request, authorization is evaluated in this order:

1. Allow a platform admin.
2. Require a membership in the requested organization.
3. Allow an organization superuser.
4. Otherwise, allow only if the membership's assigned roles grant the required permission.

## Consequences

- `admin` and `superuser` must not be represented in the configurable roles table or exposed as editable roles.
- Every organization-scoped query must constrain data by the selected organization, even when the caller has a matching permission.
- The eventual persistence model needs users, organizations, organization memberships, roles, permissions, role-permission assignments, and membership-role assignments.
- Platform-admin assignment needs a controlled internal process because it bypasses organization membership checks.
- Permission checks remain server-side; client-side permission state is only for user-interface decisions.
