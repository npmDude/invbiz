import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  createTestOrganization,
  createTestUser,
  grantPermission,
  resetDatabase,
} from '../helpers/db.js';

const hasTestDb =
  (globalThis as { __INVBIZ_TEST_DB__?: boolean }).__INVBIZ_TEST_DB__ === true;

interface Actor {
  userId: string;
  accessToken: string;
}

async function loginAs(
  app: ReturnType<typeof createApp>,
  overrides: Parameters<typeof createTestUser>[0] = {},
): Promise<Actor> {
  const { user, password } = await createTestUser(overrides);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(200);
  return { userId: user.id, accessToken: login.body.accessToken as string };
}

function expectNoPassword(body: unknown) {
  if (Array.isArray(body)) {
    for (const item of body) {
      expect(item).not.toHaveProperty('password');
    }
    return;
  }
  expect(body).not.toHaveProperty('password');
}

describe.skipIf(!hasTestDb)('users endpoints', () => {
  const app = createApp();

  let admin: Actor;

  beforeEach(async () => {
    await resetDatabase();
    admin = await loginAs(app, {
      email: 'users-admin@example.com',
      accessLevel: 'admin',
    });
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('GET /users', () => {
    it('should reject an unauthenticated request', async () => {
      const response = await request(app).get('/users').expect(401);

      expect(response.body.error.code).toBe('MISSING_ACCESS_TOKEN');
    });

    it('should list users without password hashes for an admin', async () => {
      await loginAs(app, { email: 'listed@example.com' });

      const response = await request(app)
        .get('/users')
        .set(auth(admin.accessToken))
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expectNoPassword(response.body);
    });

    it('should reject a member without the view permission', async () => {
      const member = await loginAs(app, { email: 'member@example.com' });

      const response = await request(app)
        .get('/users')
        .set(auth(member.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should require the organization id query for a member', async () => {
      const member = await loginAs(app, { email: 'noquery@example.com' });
      await grantPermission(member.userId, 'users.view');

      const response = await request(app)
        .get('/users')
        .set(auth(member.accessToken))
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_ORGANIZATION_ID');
    });

    it('should reject a member querying another organization', async () => {
      const organization = await createTestOrganization('Own Org');
      const other = await createTestOrganization('Other Org');
      const member = await loginAs(app, {
        email: 'otherorg@example.com',
        organizationId: organization.id,
      });
      await grantPermission(member.userId, 'users.view');

      const response = await request(app)
        .get(`/users?organizationId=${other.id}`)
        .set(auth(member.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should scope the list to the queried organization', async () => {
      const organization = await createTestOrganization('Scoped Org');
      const other = await createTestOrganization('Unscoped Org');
      const member = await loginAs(app, {
        email: 'scoped@example.com',
        organizationId: organization.id,
      });
      const outsider = await loginAs(app, {
        email: 'unscoped@example.com',
        organizationId: other.id,
      });
      await grantPermission(member.userId, 'users.view');

      const response = await request(app)
        .get(`/users?organizationId=${organization.id}`)
        .set(auth(member.accessToken))
        .expect(200);

      const ids = (response.body as { id: string }[]).map((user) => user.id);
      expect(ids).toContain(member.userId);
      expect(ids).not.toContain(outsider.userId);
      expectNoPassword(response.body);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user without the password hash', async () => {
      const target = await loginAs(app, { email: 'target@example.com' });

      const response = await request(app)
        .get(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({ id: target.userId });
      expectNoPassword(response.body);
    });

    it('should allow a member with the view permission in the same organization', async () => {
      const organization = await createTestOrganization('Same Org');
      const viewer = await loginAs(app, {
        email: 'viewer@example.com',
        organizationId: organization.id,
      });
      const target = await loginAs(app, {
        email: 'teammate@example.com',
        organizationId: organization.id,
      });
      await grantPermission(viewer.userId, 'users.view');

      const response = await request(app)
        .get(`/users/${target.userId}?organizationId=${organization.id}`)
        .set(auth(viewer.accessToken))
        .expect(200);

      expectNoPassword(response.body);
    });

    it('should return 404 for a user in another organization', async () => {
      const targetOrg = await createTestOrganization('Target Org');
      const outsiderOrg = await createTestOrganization('Outsider Org');
      const target = await loginAs(app, {
        email: 'target@example.com',
        organizationId: targetOrg.id,
      });
      const outsider = await loginAs(app, {
        email: 'outsider@example.com',
        organizationId: outsiderOrg.id,
      });
      await grantPermission(outsider.userId, 'users.view');

      await request(app)
        .get(`/users/${target.userId}?organizationId=${outsiderOrg.id}`)
        .set(auth(outsider.accessToken))
        .expect(404);
    });

    it('should return 404 for a missing user', async () => {
      await request(app)
        .get('/users/00000000-0000-4000-8000-000000000000')
        .set(auth(admin.accessToken))
        .expect(404);
    });
  });

  describe('POST /users', () => {
    it('should create a user without returning the password hash', async () => {
      const organization = await createTestOrganization('New Org');

      const response = await request(app)
        .post('/users')
        .set(auth(admin.accessToken))
        .send({
          name: 'New User',
          email: 'new@example.com',
          password: 'password-123',
          accessLevel: 'user',
          organizationId: organization.id,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New User',
        email: 'new@example.com',
      });
      expectNoPassword(response.body);

      // The stored hash must work for login.
      await request(app)
        .post('/auth/login')
        .send({ email: 'new@example.com', password: 'password-123' })
        .expect(200);
    });

    it('should reject a short password with VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/users')
        .set(auth(admin.accessToken))
        .send({
          name: 'New User',
          email: 'new@example.com',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require the organization id query for a member create', async () => {
      const organization = await createTestOrganization('Creator Org');
      const creator = await loginAs(app, {
        email: 'creator@example.com',
        organizationId: organization.id,
      });
      await grantPermission(creator.userId, 'users.create');

      const response = await request(app)
        .post('/users')
        .set(auth(creator.accessToken))
        .send({
          name: 'No Query',
          email: 'noquery-create@example.com',
          password: 'password-123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_ORGANIZATION_ID');
    });

    it('should let a member create a user in their organization', async () => {
      const organization = await createTestOrganization('Member Org');
      const creator = await loginAs(app, {
        email: 'member-creator@example.com',
        organizationId: organization.id,
      });
      await grantPermission(creator.userId, 'users.create');

      const response = await request(app)
        .post(`/users?organizationId=${organization.id}`)
        .set(auth(creator.accessToken))
        .send({
          name: 'Teammate',
          email: 'teammate-create@example.com',
          password: 'password-123',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        email: 'teammate-create@example.com',
        organizationId: organization.id,
      });
      expectNoPassword(response.body);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update a user without returning the password hash', async () => {
      const target = await loginAs(app, { email: 'target@example.com' });

      const response = await request(app)
        .patch(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .send({ name: 'Renamed' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: target.userId,
        name: 'Renamed',
      });
      expectNoPassword(response.body);
    });

    it('should return 404 when patching a user in another organization', async () => {
      const targetOrg = await createTestOrganization('Patch Target Org');
      const outsiderOrg = await createTestOrganization('Patch Outsider Org');
      const target = await loginAs(app, {
        email: 'patch-target@example.com',
        organizationId: targetOrg.id,
      });
      const outsider = await loginAs(app, {
        email: 'patch-outsider@example.com',
        organizationId: outsiderOrg.id,
      });
      await grantPermission(outsider.userId, 'users.manage');

      await request(app)
        .patch(`/users/${target.userId}?organizationId=${outsiderOrg.id}`)
        .set(auth(outsider.accessToken))
        .send({ name: 'Hacked' })
        .expect(404);

      const check = await request(app)
        .get(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .expect(200);
      expect(check.body.name).not.toBe('Hacked');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete a user for an admin', async () => {
      const target = await loginAs(app, { email: 'target@example.com' });

      await request(app)
        .delete(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .expect(204);

      await request(app)
        .get(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .expect(404);
    });

    it('should return 404 when deleting a user in another organization', async () => {
      const targetOrg = await createTestOrganization('Delete Target Org');
      const outsiderOrg = await createTestOrganization('Delete Outsider Org');
      const target = await loginAs(app, {
        email: 'delete-target@example.com',
        organizationId: targetOrg.id,
      });
      const outsider = await loginAs(app, {
        email: 'delete-outsider@example.com',
        organizationId: outsiderOrg.id,
      });
      await grantPermission(outsider.userId, 'users.manage');

      await request(app)
        .delete(`/users/${target.userId}?organizationId=${outsiderOrg.id}`)
        .set(auth(outsider.accessToken))
        .expect(404);

      await request(app)
        .get(`/users/${target.userId}`)
        .set(auth(admin.accessToken))
        .expect(200);
    });
  });
});
