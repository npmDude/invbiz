# ADR-0002: Branch Access Model

- Status: Accepted
- Date: 2026-09-03

## Context

An organization may operate multiple branches.

Regular users belong to exactly one organization, while platform administrators are not associated with an organization.

A regular user may be assigned to multiple branches within their organization.

Roles and permissions are organization-wide. They are not assigned separately for each branch.

The system therefore needs to distinguish between:

- **Authorization** — what a user is allowed to do.
- **Data scope** — which organization's and branch's data a user is allowed to access.
- **Access level** — whether the user is a platform administrator, organization superuser, or standard user.

## Decision

### Organization

Each non-platform user belongs to exactly one organization through `users.organization_id`.

An organization may have multiple branches.

Platform administrators are not associated with an organization and have platform-wide access.

### Branches

Each branch belongs to exactly one organization.

Non-platform users may be assigned to multiple branches through the `user_branches` relationship.

A user cannot be assigned to a branch belonging to another organization.

### Access Levels

User access is represented by a single `users.access_level` field with three values:

- **`platform_admin`** — platform-wide access across all organizations and branches. The user has no organization.
- **`superuser`** — unrestricted access within their organization, including all branches.
- **`user`** — access determined by organization roles and limited to assigned branches for branch-scoped data.

Access levels are mutually exclusive. A platform administrator cannot simultaneously be an organization superuser or standard user.

### Roles and Permissions

Roles and permissions are scoped to an organization.

A standard user's organization role determines what actions they are permitted to perform.

Branch assignments do not change a user's permissions.

Branch assignments determine which branch-scoped data the user may access.

An organization superuser does not require role-based permission checks because they have every permission within their organization.

### Platform Administrators

Platform administrators have unrestricted access across the platform.

A platform administrator:

- May access any organization.
- May access any branch.
- Has no organization assignment.
- Does not require branch assignment.
- Is not subject to organization-level role permissions or branch membership checks.

## Authorization Model

For an authenticated request:

1. Authenticate the user.
2. Determine the user's `access_level`.
3. If the user is `platform_admin`, allow platform-wide access.
4. Otherwise, verify that the user belongs to the target organization.
5. If the user is `superuser`, allow access to resources within that organization and all of its branches.
6. Otherwise, verify that the user's organization role grants the required permission.
7. If the operation is branch-scoped, verify that the user is assigned to the target branch.
8. Execute the operation using queries constrained to the authorized organization and branch.

Conceptually:

```text
Request
  │
  ▼
Authenticate
  │
  ▼
Access Level
  ├── platform_admin ──► Platform-wide Access
  │
  └── superuser?
       ├── Yes ──► All permissions + all branches
       │
       └── No
            │
            ▼
       Organization
          Role
            │
            ▼
       Branch Access
            │
            ▼
           Allow
```

## Data Ownership

The ownership hierarchy is:

```text
Organization
    │
    ├── Branch
    │     └── Branch-scoped data
    │
    └── Organization-scoped data
```

Resources that represent activity occurring at a specific branch should reference `branch_id`.

Examples include:

- Inventory
- Sales
- Purchases

Resources that represent the organization's shared catalog may be organization-scoped.

For example, a product catalog may belong to the organization while inventory quantities are maintained per branch.

## Database Model

The identity and access model consists of:

```text
users
organizations
branches
user_branches

roles
permissions
role_permissions
user_roles
```

Relationships:

```text
organizations
    │
    ├──< users
    │
    └──< branches
           │
           └──< user_branches >── users
```

Roles and permissions:

```text
organizations
    │
    └──< roles
           │
           └──< role_permissions >── permissions

users
    │
    └──< user_roles >── roles
```

## Integrity Rules

The system must enforce the following invariants:

1. A `user` belongs to exactly one organization.
2. A `superuser` belongs to exactly one organization.
3. A `platform_admin` does not belong to an organization.
4. A branch belongs to exactly one organization.
5. A `user` may only be assigned to branches belonging to their organization.
6. A `superuser` does not require branch assignments to access branches in their organization.
7. Roles belong to an organization.
8. A user may only be assigned roles belonging to their organization.
9. Organization-scoped queries must be constrained to the authorized organization.
10. Branch-scoped queries must be constrained to the authorized branch for `user` access levels.
11. Platform administrators may access all organizations and branches.
12. `users.access_level` and `users.organization_id` must remain consistent: `platform_admin` requires a null organization, while `superuser` and `user` require a non-null organization.

## Consequences

### Positive

- Access level is represented by one mutually exclusive field.
- Roles remain simple and organization-wide.
- Users can work across multiple branches without duplicating user accounts.
- Branch access is independent from permissions for standard users.
- Organization superusers can manage the entire organization without requiring branch assignments.
- Platform administrators can operate across the entire platform.
- Organization and branch boundaries are explicit in the data model.
- Business resources can clearly declare whether they are organization- or branch-scoped.

### Negative

- Branch-scoped requests require an additional access check for standard users.
- Many operational resources will require a `branch_id`.
- Cross-branch operations require explicit handling.
- The application must prevent users from combining an organization they belong to with a branch belonging to another organization.

## Alternatives Considered

### Separate `platform_access` and `access_level` fields

Rejected because two fields allow contradictory combinations and require additional integrity rules.

A single `access_level` field makes the three mutually exclusive access levels explicit.

### Branch-specific roles

Rejected because roles and permissions are organization-wide.

Adding separate roles for each branch would unnecessarily couple authorization with data scope.

### `branch_id` directly on `users`

Rejected because a user may be assigned to multiple branches.

A many-to-many `user_branches` relationship is required.

### Organization memberships

Rejected because regular users belong to exactly one organization.

`users.organization_id` directly represents the user's organization, while `user_branches` represents their branch assignments.
