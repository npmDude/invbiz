# API

Backend API for the Inventory & Business Management System.

Provides a typed Express application with runtime configuration validation, consistent JSON errors, OpenAPI documentation, a health endpoint, PostgreSQL persistence, and JWT authentication with refresh tokens.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express
- **Database:** PostgreSQL
- **ORM:** Drizzle

## Architecture

The API follows a modular, domain-oriented architecture. Domain code lives in `src/modules`, persistence lives in `src/database`, and cross-cutting concerns live in shared locations such as middlewares and shared helpers.

Controllers stay thin and delegate to services, which hold business logic and use repositories for persistence.

## Development

Install workspace dependencies from the repository root:

```bash
cd ../..
pnpm install
```

The remaining commands can run from `apps/api`.

Start the development server:

```bash
pnpm dev
```

Run only the unit tests (no Docker needed):

```bash
pnpm test:unit
```

Run only the integration tests (Docker required). DB-backed suites live in
`test/integration/`; files run sequentially (`--no-file-parallelism`)
because they share one container database and truncate it between tests:

```bash
pnpm test:integration
```

Seed the database:

```bash
pnpm db:seed
```

Create a user via the CLI (lives in `scripts/` at the repo root, outside
the deployed API bundle). Anything not passed as a flag is prompted for
interactively:

```bash
pnpm db:create-user
pnpm db:create-user -- --name "Ada" --email "ada@example.com" --access-level admin
```

Any value can also be passed as a flag for non-interactive use (missing
values still prompt):

```bash
pnpm db:create-user -- --name "Ada" --email ada@example.com --password secret123 --access-level user --organization-id <uuid>
```

## Database Migrations

Schema live in `src/database/schemas/`; the applied DDL lives in the
committed `drizzle/` folders. After any schema change, regenerate:

```bash
npx drizzle-kit generate
```

Commit the new migration folder together with the schema edit so the two
can never drift apart. Never hand-edit a migration that has already been
applied to a shared database — generate a new one on top instead.

`test:integration` applies `drizzle/` to a fresh container on every run,
so a broken migration or a constraint your fixtures violate fails the
suite before it ever reaches a real database.

Run type checking:

```bash
pnpm typecheck
```

Run linting:

```bash
pnpm lint
```

Format source files:

```bash
pnpm format
```

Build the production output:

```bash
pnpm build
```

## Environment Variables

Create a `.env` file based on `.env.example`.

Never commit `.env` or production secrets to the repository.

## API Documentation

The health endpoint is available at `GET /health`. Interactive OpenAPI documentation is available at `/docs` when the development server is running.

## Design Principles

### Keep controllers thin

Business logic should not live inside controllers.

### Keep repositories focused on persistence

Repositories handle persistence concerns such as queries and transactions. Business decisions belong in services.

### Keep business logic independent of HTTP

Services should be callable without an Express request, so the same operations can be reused outside HTTP workflows.

### Prefer domain-oriented modules

Group business functionality by domain rather than technical layer. This keeps related functionality together as the application grows.
