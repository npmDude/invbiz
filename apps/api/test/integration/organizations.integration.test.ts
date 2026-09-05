import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { db } from '../../src/database/index.js';
import { usersTable } from '../../src/database/schemas/users.js';
import {
  createTestOrganization,
  createTestUser,
  resetDatabase,
} from '../helpers/db.js';

const hasTestDb =
  (globalThis as { __INVBIZ_TEST_DB__?: boolean }).__INVBIZ_TEST_DB__ === true;

interface Actor {
  accessToken: string;
}

async function loginAs(
  app: ReturnType<typeof createApp>,
  overrides: Parameters<typeof createTestUser>[0] = {},
): Promise<Actor & { userId: string }> {
  const { user, password } = await createTestUser(overrides);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password })
    .expect(200);
  return { userId: user.id, accessToken: login.body.accessToken as string };
}

describe.skipIf(!hasTestDb)('organizations endpoints', () => {
  const app = createApp();

  let admin: Actor;
  let member: Actor & { userId: string; organizationId: string };
  let outsider: Actor;

  beforeEach(async () => {
    await resetDatabase();

    admin = await loginAs(app, {
      email: 'org-admin@example.com',
      accessLevel: 'admin',
    });

    const organization = await createTestOrganization('Acme');
    const memberLogin = await loginAs(app, {
      email: 'org-member@example.com',
      organizationId: organization.id,
    });
    member = { ...memberLogin, organizationId: organization.id };

    outsider = await loginAs(app, { email: 'org-outsider@example.com' });
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('GET /organizations', () => {
    it('should reject an unauthenticated request', async () => {
      const response = await request(app).get('/organizations').expect(401);

      expect(response.body.error.code).toBe('MISSING_ACCESS_TOKEN');
    });

    it('should list organizations for an admin', async () => {
      const response = await request(app)
        .get('/organizations')
        .set(auth(admin.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((org: { name: string }) => org.name)).toEqual(
        expect.arrayContaining(['Acme']),
      );
    });

    it('should reject a non-admin with 403', async () => {
      const response = await request(app)
        .get('/organizations')
        .set(auth(member.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /organizations/:id', () => {
    it('should return the organization for a member', async () => {
      const response = await request(app)
        .get(`/organizations/${member.organizationId}`)
        .set(auth(member.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({
        id: member.organizationId,
        name: 'Acme',
      });
    });

    it('should return the organization for an admin', async () => {
      await request(app)
        .get(`/organizations/${member.organizationId}`)
        .set(auth(admin.accessToken))
        .expect(200);
    });

    it('should reject an outsider with 403', async () => {
      const response = await request(app)
        .get(`/organizations/${member.organizationId}`)
        .set(auth(outsider.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for an admin when the organization is missing', async () => {
      const response = await request(app)
        .get('/organizations/00000000-0000-4000-8000-000000000000')
        .set(auth(admin.accessToken))
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND_ERROR');
    });
  });

  describe('POST /organizations', () => {
    it('should create an organization for an admin', async () => {
      const response = await request(app)
        .post('/organizations')
        .set(auth(admin.accessToken))
        .send({ name: 'Globex' })
        .expect(201);

      expect(response.body).toMatchObject({ name: 'Globex' });
      expect(typeof response.body.id).toBe('string');
    });

    it('should reject a non-admin with 403', async () => {
      const response = await request(app)
        .post('/organizations')
        .set(auth(member.accessToken))
        .send({ name: 'Globex' })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should reject an empty name with VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/organizations')
        .set(auth(admin.accessToken))
        .send({ name: '  ' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /organizations/:id', () => {
    it('should rename the organization for a member', async () => {
      const response = await request(app)
        .patch(`/organizations/${member.organizationId}`)
        .set(auth(member.accessToken))
        .send({ name: 'Acme Renamed' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: member.organizationId,
        name: 'Acme Renamed',
      });
    });

    it('should rename the organization for an admin', async () => {
      await request(app)
        .patch(`/organizations/${member.organizationId}`)
        .set(auth(admin.accessToken))
        .send({ name: 'Acme Renamed' })
        .expect(200);
    });

    it('should reject an outsider with 403', async () => {
      const response = await request(app)
        .patch(`/organizations/${member.organizationId}`)
        .set(auth(outsider.accessToken))
        .send({ name: 'Hacked' })
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for an admin when the organization is missing', async () => {
      await request(app)
        .patch('/organizations/00000000-0000-4000-8000-000000000000')
        .set(auth(admin.accessToken))
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('should reject an empty name with VALIDATION_ERROR', async () => {
      const response = await request(app)
        .patch(`/organizations/${member.organizationId}`)
        .set(auth(member.accessToken))
        .send({ name: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /organizations/:id', () => {
    it('should delete the organization for an admin and cascade members', async () => {
      await request(app)
        .delete(`/organizations/${member.organizationId}`)
        .set(auth(admin.accessToken))
        .expect(204);

      await request(app)
        .get(`/organizations/${member.organizationId}`)
        .set(auth(admin.accessToken))
        .expect(404);

      const remaining = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, member.userId));
      expect(remaining).toHaveLength(0);
    });

    it('should reject a member with 403', async () => {
      const response = await request(app)
        .delete(`/organizations/${member.organizationId}`)
        .set(auth(member.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 404 for an admin when the organization is missing', async () => {
      await request(app)
        .delete('/organizations/00000000-0000-4000-8000-000000000000')
        .set(auth(admin.accessToken))
        .expect(404);
    });
  });
});
