# API

Backend API for the Inventory & Business Management System.

Built with **TypeScript, Express, PostgreSQL, Drizzle ORM, and Zod**.

## Tech Stack

* **Runtime:** Node.js
* **Language:** TypeScript
* **Framework:** Express
* **Database:** PostgreSQL
* **ORM:** Drizzle
* **Validation:** Zod
* **Testing:** Vitest
* **API Documentation:** OpenAPI / Swagger
* **Authentication:** JWT / Session-based authentication

## Architecture

The API follows a modular, domain-oriented architecture.

### Responsibilities

**Middleware / Hooks**

Handle concerns around API operations:

* Authentication
* Authorization
* Request validation
* Organization/tenant context
* Rate limiting
* Audit logging

**Controllers**

Handle HTTP-specific concerns:

* Reading request data
* Calling services
* Returning HTTP responses
* Mapping errors to HTTP status codes

Controllers should contain minimal business logic.

**Services**

Contain application and business logic.

Examples:

* Creating and updating products
* Receiving inventory
* Processing sales
* Adjusting stock
* Creating inventory movements
* Validating business rules

**Repositories**

Handle database access.

Repositories are the boundary between the application and PostgreSQL and use Drizzle for queries and persistence.

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
├── domains/
│   ├── auth/
│   ├── users/
│   └── domain/
│       ├── domain.controller.ts
│       ├── domain.service.ts
│       ├── domain.repository.ts
│       ├── domain.rules.ts
│       ├── domain.schema.ts
│       └── domain.types.ts
│
└── database/
```

Business rules that are part of the actual workflow should remain in the service or dedicated domain functions.

## Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

Run linting:

```bash
npm run lint
```

## Environment Variables

Create a `.env` file based on `.env.example`.

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://user:password@localhost:5432/inventory

JWT_SECRET=your-secret
```

Never commit `.env` or production secrets to the repository.

## Database

Database schema and migrations are managed through Drizzle.

Typical workflow:

```bash
npm run db:generate
npm run db:migrate
```

For local development, PostgreSQL can be run using Docker.

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

* Queries
* Inserts
* Updates
* Deletes
* Database transactions

Business decisions belong in services.

### Keep business logic independent of HTTP

Services should be callable without an Express request.

This allows the same business operations to be reused by:

* HTTP controllers
* Background jobs
* CLI commands
* Other application workflows

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
