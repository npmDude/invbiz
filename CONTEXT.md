# InvBiz

Web-first inventory and business management for organizations tracking inventory across branches.

## Language

**Organization**:
The top-level scope owning branches, products, and categories.
_Avoid_: company, tenant

**Branch**:
A location within an organization where inventory is held. Each branch belongs to exactly one organization.
_Avoid_: store, outlet

**Category**:
An organization-scoped grouping for products, optionally nested under a parent category.
_Avoid_: tag, group

**Product**:
An organization-scoped catalog entry with name, code, and supplier price. It carries no quantity.
_Avoid_: stock, item

**Inventory**:
The branch-specific state of a product: current quantity and sale price.
_Avoid_: stocks, stock level
