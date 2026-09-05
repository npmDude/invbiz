import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

/**
 * Ran once before all test files (vitest `globalSetup`). Starts a single
 * Postgres container shared by every worker, applies committed drizzle
 * migrations, and publishes the connection string via a tmp file because
 * `globalSetup` cannot pass `process.env` into worker processes.
 *
 * Set `INVBIZ_SKIP_TEST_DB=1` to skip (unit tests then run without Docker;
 * the integration suite self-skips — see `test/setup.ts`).
 */
export const TEST_DB_URL_FILE = join(tmpdir(), 'invbiz-test-database-url.txt');

const MIGRATIONS_FOLDER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'drizzle',
);

export default async function setup() {
  if (process.env.INVBIZ_SKIP_TEST_DB === '1') {
    // Remove any stale connection string so workers fall back to unit
    // tests only and the integration suite self-skips.
    await rm(TEST_DB_URL_FILE, { force: true });
    return;
  }

  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();
  await writeFile(TEST_DB_URL_FILE, url, 'utf8');

  const db = drizzle({
    connection: { connectionString: url },
  });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await db.$client.end();

  return async () => {
    await container.stop();
  };
}
