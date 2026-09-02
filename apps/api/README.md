# API

Backend API for the Inventory & Business Management System.

The initial foundation provides a typed Express application, runtime configuration validation, consistent JSON errors, OpenAPI documentation, and a health endpoint. PostgreSQL and Drizzle will be added with the first persistence-backed domain.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express
- **Database:** PostgreSQL
- **ORM:** Drizzle
- **Validation:** Zod
- **Testing:** Vitest
- **API Documentation:** OpenAPI / Swagger
- **Authentication:** JWT / Session-based authentication

## Architecture

The API follows a modular, domain-oriented architecture.

## Project Structure

```text
src/
├── app.ts
├── server.ts
│
├── middlewares/
│   ├── auth.ts
│   ├── error-handler.ts
│   ├── request-context.ts
│   └── rate-limit.ts
│
├── modules/
│   ├── auth/
│   ├── users/
│   └── {domain}/
│       ├── {domain}.controller.ts
│       ├── {domain}.service.ts
│       ├── {domain}.repository.ts
│       ├── {domain}.rules.ts
│       ├── {domain}.schema.ts
│       └── {domain}.types.ts
│
└── database/
```

Business rules that are part of the actual workflow should remain in the service or dedicated domain functions.

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

Run tests:

```bash
pnpm test
```

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

The health endpoint is available at `GET /api/health`. Interactive OpenAPI documentation is available at `/api/docs`.

## Environment Variables

Create a `.env` file based on `.env.example`.

```env
NODE_ENV=development
PORT=3000
```

Never commit `.env` or production secrets to the repository.

## API Documentation

OpenAPI documentation will be available at:

```text
/api/docs
```

when the development server is running.

## Design Principles

### Keep controllers thin

```text
Controller → Service → Repository
```

Business logic should not live inside controllers.

### Keep repositories focused on persistence

Repositories should handle:

- Queries
- Inserts
- Updates
- Deletes
- Database transactions

Business decisions belong in services.

### Keep business logic independent of HTTP

Services should be callable without an Express request.

This allows the same business operations to be reused by:

- HTTP controllers
- Background jobs
- CLI commands
- Other application workflows

### Prefer domain-oriented modules

Business functionality should be grouped by domain rather than technical layer.

```text
modules/
├── products/
├── inventory/
├── sales/
└── purchases/
```

This keeps related functionality together as the application grows.
