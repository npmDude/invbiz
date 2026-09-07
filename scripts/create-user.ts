/**
 * CLI that creates a user in the InvBiz database.
 *
 * Lives in `scripts/` (outside `apps/api/`) so it is never part of the
 * deployed API bundle (`apps/api` builds only `src/**`).
 *
 * It reuses the API's services (password hashing, persistence) via relative
 * imports, so business rules stay in a single place. `commander` and
 * `@clack/prompts` resolve from the workspace root `node_modules`; API
 * modules are dynamically imported after `DATABASE_URL` is resolved so the
 * value is available when the `db` singleton is created.
 *
 * Run from the repository root:
 *
 *   pnpm --dir apps/api run db:create-user
 *   pnpm --dir apps/api run db:create-user -- --name "Ada" --email "ada@example.com" --access-level admin
 *
 * Requires `DATABASE_URL` (flag, env var, or `apps/api/.env`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { stdin as input } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';

const ACCESS_LEVELS = ['admin', 'superuser', 'user'] as const;

type AccessLevel = (typeof ACCESS_LEVELS)[number];

interface CreateUserFlags {
  name?: string;
  email?: string;
  password?: string;
  accessLevel?: string;
  organizationId?: string;
  roleId?: string;
  databaseUrl?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const program = new Command();

program
  .name('create-user')
  .description(
    'Create an InvBiz user. Anything not passed as a flag is asked interactively.',
  )
  .option('--name <name>', 'display name (1-255 chars)')
  .option('--email <email>', 'login email, must be unique')
  .option(
    '--password <password>',
    'password (min 8 chars; prefer the hidden prompt, flags stay in shell history)',
  )
  .option(
    '--access-level <level>',
    'admin | superuser | user (default: user)',
  )
  .option(
    '--organization-id <uuid>',
    'organization ID (required unless access level is admin)',
  )
  .option(
    '--role-id <uuid>',
    'role ID (optional, only for access level user)',
  )
  .option(
    '--database-url <url>',
    'PostgreSQL connection string (overrides DATABASE_URL and apps/api/.env)',
  )
  .showHelpAfterError()
  .addHelpText(
    'after',
    '\nExamples:\n' +
      '  $ create-user\n' +
      '  $ create-user --name "Ada" --email "ada@example.com" --access-level admin\n',
  )
  .parse(process.argv);

const flags = program.opts() as CreateUserFlags;

function validateName(value: string | undefined): string | undefined {
  if (!value) return 'Name must not be empty.';
  if (value.length > 255) return 'Name must be at most 255 characters.';
  return undefined;
}

function validateEmail(value: string | undefined): string | undefined {
  if (!value) return 'Email must not be empty.';
  if (value.length > 255) return 'Email must be at most 255 characters.';
  if (!EMAIL_RE.test(value)) return 'Email must be a valid email address.';
  return undefined;
}

function validatePassword(value: string | undefined): string | undefined {
  if (!value || value.length < 8)
    return 'Password must be at least 8 characters.';
  if (value.length > 255) return 'Password must be at most 255 characters.';
  return undefined;
}

function validateOrganizationId(
  value: string | undefined,
): string | undefined {
  if (!value) return 'Organization ID is required for this access level.';
  if (!UUID_RE.test(value)) return 'Organization ID must be a valid UUID.';
  return undefined;
}

function validateRoleId(value: string | undefined): string | undefined {
  if (value && !UUID_RE.test(value)) return 'Role ID must be a valid UUID.';
  return undefined;
}

function parseAccessLevel(value: string | undefined): AccessLevel | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if ((ACCESS_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as AccessLevel;
  }
  return undefined;
}

function fail(message: string): never {
  p.log.error(message);
  process.exit(1);
}

function orAbort<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Aborted — no user was created.');
    process.exit(0);
  }
  return value;
}

/**
 * Minimal `.env` file parser (no third-party deps). Only fills keys that are
 * not already set so real environment variables always win.
 */
function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  // Resolved relative to this file so the CLI works from any cwd.
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  loadEnvFile(path.join(scriptDir, '..', 'apps', 'api', '.env'));

  if (!process.env.DATABASE_URL) {
    fail(
      'DATABASE_URL is not set. Pass --database-url, export it, or define it in apps/api/.env (see apps/api/.env.example).',
    );
  }
}

async function main(): Promise<void> {
  if (flags.databaseUrl) {
    process.env.DATABASE_URL = flags.databaseUrl;
  }

  // Validate flag-provided values up front, before prompting or touching the DB.
  const nameFlag = flags.name?.trim() || undefined;
  const emailFlag = flags.email?.trim() || undefined;
  const organizationFlag = flags.organizationId?.trim() || undefined;
  const roleFlag = flags.roleId?.trim() || undefined;
  const accessFlag = parseAccessLevel(flags.accessLevel);

  const flagErrors: string[] = [];
  if (nameFlag !== undefined) {
    const error = validateName(nameFlag);
    if (error) flagErrors.push(`--name: ${error}`);
  }
  if (emailFlag !== undefined) {
    const error = validateEmail(emailFlag);
    if (error) flagErrors.push(`--email: ${error}`);
  }
  if (flags.password !== undefined) {
    const error = validatePassword(flags.password);
    if (error) flagErrors.push(`--password: ${error}`);
  }
  if (flags.accessLevel !== undefined && accessFlag === undefined) {
    flagErrors.push('--access-level: must be admin, superuser, or user.');
  }
  if (organizationFlag !== undefined) {
    const error = validateOrganizationId(organizationFlag);
    if (error) flagErrors.push(`--organization-id: ${error}`);
  }
  if (roleFlag !== undefined) {
    const error = validateRoleId(roleFlag);
    if (error) flagErrors.push(`--role-id: ${error}`);
  }
  if (accessFlag === 'admin' && organizationFlag !== undefined) {
    flagErrors.push('--organization-id: must not be set for admin users.');
  }
  if (accessFlag !== undefined && accessFlag !== 'user' && roleFlag !== undefined) {
    flagErrors.push('--role-id: only access level user can have a role.');
  }
  for (const error of flagErrors) {
    p.log.error(error);
  }
  if (flagErrors.length > 0) {
    process.exit(1);
  }

  const interactive = input.isTTY === true;

  const need = (label: string): never =>
    fail(`Missing ${label} (non-interactive session — provide it as a flag).`);

  p.intro('Create InvBiz user');

  let name = nameFlag;
  if (!name) {
    if (!interactive) need('--name');
    name = orAbort(
      await p.text({
        message: 'Name',
        validate: (value) => validateName(value?.trim()),
      }),
    ).trim();
  }

  let email = emailFlag;
  if (!email) {
    if (!interactive) need('--email');
    email = orAbort(
      await p.text({
        message: 'Email',
        validate: (value) => validateEmail(value?.trim()),
      }),
    ).trim();
  }

  let password = flags.password;
  if (!password) {
    if (!interactive) need('--password');
    password = orAbort(
      await p.password({
        message: 'Password',
        mask: '*',
        validate: (value) => validatePassword(value),
      }),
    );
  }

  let accessLevel = accessFlag;
  if (!accessLevel) {
    if (!interactive) {
      accessLevel = 'user';
    } else {
      accessLevel = orAbort(
        await p.select({
          message: 'Access level',
          initialValue: 'user',
          options: [
            {
              value: 'admin',
              label: 'admin',
              hint: 'no organization, platform-wide',
            },
            {
              value: 'superuser',
              label: 'superuser',
              hint: 'requires an organization',
            },
            {
              value: 'user',
              label: 'user',
              hint: 'requires an organization, optional role',
            },
          ],
        }),
      ) as AccessLevel;
    }
  }

  let organizationId: string | null = organizationFlag ?? null;
  if (accessLevel !== 'admin' && !organizationId) {
    if (!interactive) need('--organization-id');
    organizationId = orAbort(
      await p.text({
        message: 'Organization ID',
        validate: validateOrganizationId,
      }),
    ).trim();
  }

  let roleId: string | null = roleFlag ?? null;
  if (accessLevel === 'user' && !roleId && interactive) {
    const roleInput = orAbort(
      await p.text({
        message: 'Role ID',
        placeholder: 'Optional — Enter to skip',
        validate: (value) => validateRoleId(value?.trim()),
      }),
    ).trim();
    roleId = roleInput || null;
  }

  ensureDatabaseUrl();

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const apiSrc = path.join(scriptDir, '..', 'apps', 'api', 'src');
  const toUrl = (rel: string) => pathToFileURL(path.join(apiSrc, rel)).href;

  const { usersService } = (await import(
    toUrl('modules/users/users.service.ts')
  )) as typeof import('../apps/api/src/modules/users/users.service');
  const { authService } = (await import(
    toUrl('modules/auth/auth.service.ts')
  )) as typeof import('../apps/api/src/modules/auth/auth.service');
  const { db } = (await import(toUrl('database/index.ts'))) as typeof import(
    '../apps/api/src/database/index'
  );

  try {
    const existing = await usersService.findOne({ email });
    if (existing) {
      fail(`A user with email "${email}" already exists.`);
    }

    // The spinner manipulates the cursor, so only use it on a TTY.
    const spinner = interactive ? p.spinner() : undefined;
    spinner?.start('Hashing password and creating user');

    const passwordHash = await authService.hashPassword(password);

    const user = await usersService.create({
      organizationId,
      roleId,
      name,
      email,
      password: passwordHash,
      accessLevel,
    });

    spinner?.stop('User created');
    if (!interactive) {
      p.log.success('User created');
    }

    p.note(
      `id:             ${user.id}\nname:           ${user.name}\nemail:          ${user.email}\naccessLevel:    ${user.accessLevel}\norganizationId: ${user.organizationId ?? '(none)'}\nroleId:         ${user.roleId ?? '(none)'}`,
      'User created',
    );
    p.outro('Done.');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      fail(`A user with email "${email}" already exists.`);
    }
    throw error;
  } finally {
    await db.$client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : 'Failed to create user.');
  process.exit(1);
});
