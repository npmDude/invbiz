# ADR-0005: Branch Inventory State in `branches_products`

- Status: Accepted
- Date: 2026-09-09
- Amends: ADR-0002 (branch-scoped inventory data)

## Context

ADR-0002 states inventory quantities are maintained per branch, but no table
represented that state: `products` is an organization-scoped catalog
(`name`, `code`, `supplierPrice`, `stockAlert`) with no quantity. Clients need
a per-branch current count and per-branch selling price, while quantity changes
must flow through auditable operations (movements, sales), never direct edits.

## Decision

1. New `branches_products` table holding Inventory state: composite primary key
   `(branch_id, product_id)`, `quantity INTEGER NOT NULL DEFAULT 0
   CHECK (quantity >= 0)`, `sale_price NUMERIC(12,2) NOT NULL
   CHECK (sale_price >= 0)`, timestamps, cascading foreign keys to `branches`
   and `products`. Name follows the ADR-0004 `plural_plural` join convention;
   the `(branch_id, product_id)` key already indexes branch lookups, so only an
   extra index on `product_id` is added.
2. `POST /products` requires `branchPrices: [{ branchId, salePrice }]` (min 1)
   and pre-creates zero-quantity rows for the selected branches. Branches must
   belong to the product's organization (service-layer check, mirroring
   ADR-0003/0004); duplicates are rejected.
3. `quantity` starts at zero unless an opening quantity is supplied: both
   `POST /products` (per-branch rows) and `POST /inventory` accept the initial
   count, and it can never go negative. After creation, quantity changes flow
   through auditable operations (movements, sales), never direct edits —
   `PATCH /inventory/:branchId/:productId` updates `salePrice` only.
4. The HTTP resource is `inventory` (`GET /inventory`,
   `POST /inventory`, `PATCH /inventory/:branchId/:productId`) with
   `inventory.view`, `inventory.create`, and `inventory.manage` permissions,
   mirroring the `view`/`create`/`manage` triple used by the other resources.
   `inventory.create` guards `POST /inventory`, which stocks an existing
   product in a branch (e.g. a newly added branch) with a zero quantity and an
   explicit `salePrice`. Rows are never auto-created for new branches because
   `salePrice` has no sensible default.
5. Reads are branch-scoped per ADR-0002: standard users are narrowed to assigned
   branches and rejected (403) when querying an unassigned branch; `admin` and
   `superuser` bypass assignment checks. The same narrowing applies to
   `POST /inventory` and to the `branchPrices` embedded in product reads
   (`GET /products`, `GET /products/:id`, `PATCH /products/:id`): the product
   itself stays visible org-wide, but prices are sourced from
   `InventoryService.listForProducts` so unassigned branches are excluded.
   Product reads own no scoping logic of their own.

## Consequences

- Product creation fans out rows per selected branch; stocking an existing
  product in an additional branch goes through `POST /inventory`
  (`inventory.create`). Removing branch availability has no endpoint yet.
- `lastCost` is not stored: purchase-price history will live on movement rows
  when the movements ledger lands. `stockAlert` stays on `products` until
  per-branch alerts are required.
- Product creation is not yet wrapped in a single transaction: if inventory-row
  insertion fails after the product row is created, the product exists without
  inventory. Acceptable while inserts are sequential single statements;
  revisit with the movements work.
