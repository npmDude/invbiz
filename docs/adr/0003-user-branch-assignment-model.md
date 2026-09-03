# ADR-0003: User-Branch Assignment Model

* **Status:** Accepted
* **Date:** 2026-09-03

## Context

Users belong to one organization and may be assigned to multiple branches within that organization. A many-to-many junction table is required.

Because both `users` and `branches` already contain `organization_id`, duplicating it in `user_branches` would introduce redundant data and additional constraints.

## Decision

Use a minimal `user_branches` table containing only `user_id` and `branch_id`.

```text
user_branches
├── user_id
└── branch_id
```

Use `(user_id, branch_id)` as the composite primary key and foreign keys to `users.id` and `branches.id`.

Organization consistency is enforced at the service layer:

```text
users.organization_id = branches.organization_id
```

Assignments between users and branches belonging to different organizations must be rejected.

## Indexing

The composite primary key provides an index for `user_id` queries. Add a separate index on `branch_id` for queries that retrieve users assigned to a branch.

## Cascade Behavior

Deleting a user or branch cascades to its `user_branches` records.

## Alternatives Considered

### Include `organization_id`

Rejected because it duplicates data already available through the related user and branch and adds schema complexity.

### Add `branch_id` to `users`

Rejected because users can belong to multiple branches.
