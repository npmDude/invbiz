import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { TEST_DB_URL_FILE } from './global-setup.js';

/**
 * Runs in every worker before test files are imported. Loads the committed
 * `.env.test` (overriding local `.env` so tests are deterministic), then
 * points the app's import-time singletons (`db`, services) at the
 * Testcontainers database by setting `DATABASE_URL` before any `src/`
 * module is evaluated.
 */
declare global {
  var __INVBIZ_TEST_DB__: boolean | undefined;
}

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.test'),
  override: true,
});

try {
  const url = (await readFile(TEST_DB_URL_FILE, 'utf8')).trim();

  if (url) {
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SSL = 'false';
    globalThis.__INVBIZ_TEST_DB__ = true;
  }
} catch {
  globalThis.__INVBIZ_TEST_DB__ = false;
}
