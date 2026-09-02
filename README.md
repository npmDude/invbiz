# InvBiz

A flexible inventory and business management system designed to help businesses track inventory, sales, purchases and day-to-day operations.

## Product Vision

InvBiz will provide a web-first inventory and business management experience backed by a typed API and relational database. A native mobile app is planned but is not part of the initial implementation.

### Intended Stack

- API: Express, TypeScript, PostgreSQL, Drizzle, Zod, JWT/session authentication, Vitest, and OpenAPI/Swagger.
- Web: React, TanStack, TypeScript, and Tailwind CSS.
- Native: React Native, deferred until after the web product is established.

## Project Structure

- `apps/` contains deployable products with their own runtime and entrypoint, such as `apps/web`, `apps/api`, and `apps/native`.
- `docs/adr/` contains accepted architecture decisions.
- API endpoints belong in `apps/api/`. Shared request-independent business rules can move to `packages/domain/` when another app needs them.
- `packages/` contains reusable code that is imported by one or more apps, such as domain models, UI components, or shared tooling.
- Keep code in its owning app until there is a real second consumer, then extract it into `packages/`.

## Development

This repository uses pnpm `11.25.0` through Corepack. Enable Corepack once if pnpm is not already available:

```bash
corepack enable
```

The API is independently runnable from `apps/api`:

```bash
cd apps/api
pnpm install
pnpm dev
```

Validate the API with:

```bash
cd apps/api
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```
