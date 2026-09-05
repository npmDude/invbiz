import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';

import { db } from '../../src/database/index.js';
import { organizationsTable } from '../../src/database/schemas/organizations.js';
import { permissionsTable } from '../../src/database/schemas/permissions.js';
import { rolePermissionsTable } from '../../src/database/schemas/role-permissions.js';
import { rolesTable } from '../../src/database/schemas/roles.js';
import {
  usersTable,
  type AccessLevel,
} from '../../src/database/schemas/users.js';
import { userRolesTable } from '../../src/database/schemas/user-roles.js';

export async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE
      refresh_tokens,
      user_branches,
      user_roles,
      role_permissions,
      branches,
      roles,
      users,
      organizations,
      permissions
    RESTART IDENTITY CASCADE
  `);
}

export async function createTestOrganization(name = 'Test Org') {
  const [organization] = await db
    .insert(organizationsTable)
    .values({ name })
    .returning();

  if (!organization) {
    throw new Error('Failed to create test organization');
  }

  return organization;
}

interface CreateTestUserInput {
  email?: string;
  password?: string;
  name?: string;
  accessLevel?: AccessLevel;
  organizationId?: string;
}

/**
 * Create a user with a bcrypt-hashed password. Regular users and superusers
 * require an organization (DB check constraint); one is created on demand.
 * Admins must have `organizationId: NULL`.
 */
export async function createTestUser(input: CreateTestUserInput = {}) {
  const {
    email = `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    password = 'correct-password',
    name = 'Test User',
    accessLevel = 'user',
  } = input;

  let organizationId = input.organizationId;

  if (accessLevel === 'admin') {
    organizationId = undefined;
  } else if (!organizationId) {
    organizationId = (await createTestOrganization()).id;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      organizationId,
      name,
      email,
      password: await bcrypt.hash(password, 4),
      accessLevel,
    })
    .returning();

  if (!user) {
    throw new Error('Failed to create test user');
  }

  return { user, password };
}

/**
 * Grant a permission to a user via a fresh role: upserts the permission row,
 * creates a role in the user's organization, and links both join tables
 * (`role_permissions`, `user_roles`) — mirroring `findPermissionKeys`.
 */
export async function grantPermission(userId: string, permissionId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`${usersTable.id} = ${userId}`)
    .limit(1);

  if (!user?.organizationId) {
    throw new Error('grantPermission requires a user with an organization');
  }

  await db
    .insert(permissionsTable)
    .values({ id: permissionId, description: `${permissionId} (test)` })
    .onConflictDoNothing({ target: permissionsTable.id });

  const [role] = await db
    .insert(rolesTable)
    .values({
      organizationId: user.organizationId,
      name: `test-role-${permissionId}-${Date.now()}`,
    })
    .returning();

  if (!role) {
    throw new Error('Failed to create test role');
  }

  await db
    .insert(rolePermissionsTable)
    .values({ roleId: role.id, permissionId });

  await db.insert(userRolesTable).values({ userId, roleId: role.id });

  return role;
}
