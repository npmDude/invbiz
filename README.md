# InvBiz
A flexible inventory and business management system designed to help businesses track inventory, sales, purchases and day-to-day operations.

## Project Structure

- `apps/` contains deployable products with their own runtime and entrypoint, such as `apps/web`, `apps/api`, and `apps/native`.
- API endpoints belong in `apps/api/`. Shared request-independent business rules can move to `packages/domain/` when another app needs them.
- `packages/` contains reusable code that is imported by one or more apps, such as domain models, UI components, or shared tooling.
- Keep code in its owning app until there is a real second consumer, then extract it into `packages/`.
