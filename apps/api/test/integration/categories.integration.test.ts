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
  organizationId: string | null;
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
  return {
    userId: user.id,
    organizationId: user.organizationId,
    accessToken: login.body.accessToken as string,
  };
}

describe.skipIf(!hasTestDb)('categories endpoints', () => {
  const app = createApp();

  let admin: Actor;
  let member: Actor;
  let outsider: Actor;

  beforeEach(async () => {
    await resetDatabase();

    admin = await loginAs(app, {
      email: 'categories-admin@example.com',
      accessLevel: 'admin',
    });

    const organization = await createTestOrganization('Categories Org');
    member = await loginAs(app, {
      email: 'categories-member@example.com',
      organizationId: organization.id,
    });
    await grantPermission(member.userId, 'categories.view');
    await grantPermission(member.userId, 'categories.create');
    await grantPermission(member.userId, 'categories.manage');

    outsider = await loginAs(app, { email: 'categories-outsider@example.com' });
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function orgQuery(organizationId: string | null) {
    return { organizationId: organizationId as string };
  }

  describe('GET /categories', () => {
    it('should reject an unauthenticated request', async () => {
      const response = await request(app).get('/categories').expect(401);

      expect(response.body.error.code).toBe('MISSING_ACCESS_TOKEN');
    });

    it('should list only the requested organization categories', async () => {
      const other = await createTestOrganization('Other Categories Org');

      if (!member.organizationId) {
        throw new Error('Member must belong to an organization');
      }

      await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({ organizationId: member.organizationId, name: 'Own' })
        .expect(201);
      await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({ organizationId: other.id, name: 'Other' })
        .expect(201);

      const response = await request(app)
        .get('/categories')
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(200);

      expect(response.body.map((c: { name: string }) => c.name)).toEqual([
        'Own',
      ]);
    });

    it('should reject a member querying another organization', async () => {
      const other = await createTestOrganization('Foreign Org');

      const response = await request(app)
        .get('/categories')
        .query(orgQuery(other.id))
        .set(auth(member.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should reject a member without the view permission', async () => {
      const unprivileged = await loginAs(app, {
        email: 'categories-noperm@example.com',
        organizationId: member.organizationId as string,
      });

      const response = await request(app)
        .get('/categories')
        .query(orgQuery(member.organizationId))
        .set(auth(unprivileged.accessToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('POST /categories', () => {
    it('should create a root category with a default order', async () => {
      const response = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Beverages' })
        .expect(201);

      expect(response.body).toMatchObject({
        organizationId: member.organizationId,
        name: 'Beverages',
        parentId: null,
        order: 0,
      });
    });

    it('should create a child category within the same organization', async () => {
      const parent = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Food' })
        .expect(201);

      const child = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Snacks',
          parentId: parent.body.id,
          order: 2,
        })
        .expect(201);

      expect(child.body).toMatchObject({
        parentId: parent.body.id,
        order: 2,
      });
    });

    it('should reject a parent from another organization', async () => {
      const foreign = await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({
          organizationId: outsider.organizationId,
          name: 'Foreign',
        })
        .expect(201);

      const response = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Hijack',
          parentId: foreign.body.id,
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST_ERROR');
    });

    it('should reject a negative order with VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Bad', order: -1 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject a duplicate name within the same organization', async () => {
      await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Beverages' })
        .expect(201);

      const response = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Beverages' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT_ERROR');
    });

    it('should allow the same name in a different organization', async () => {
      await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Shared' })
        .expect(201);

      await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({ organizationId: outsider.organizationId, name: 'Shared' })
        .expect(201);
    });
  });

  describe('GET /categories/:id', () => {
    it('should return the category for a member of the organization', async () => {
      const created = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Dairy' })
        .expect(201);

      const response = await request(app)
        .get(`/categories/${created.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(200);

      expect(response.body).toMatchObject({ name: 'Dairy' });
    });

    it('should return 404 when the category belongs to another organization', async () => {
      const foreign = await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({
          organizationId: outsider.organizationId,
          name: 'Foreign',
        })
        .expect(201);

      await request(app)
        .get(`/categories/${foreign.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(404);
    });
  });

  describe('PATCH /categories/:id', () => {
    it('should rename the category', async () => {
      const created = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Old' })
        .expect(201);

      const response = await request(app)
        .patch(`/categories/${created.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .send({ name: 'New' })
        .expect(200);

      expect(response.body).toMatchObject({ name: 'New' });
    });

    it('should reject renaming to an existing name with 409', async () => {
      await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Taken' })
        .expect(201);
      const other = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Free' })
        .expect(201);

      const response = await request(app)
        .patch(`/categories/${other.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .send({ name: 'Taken' })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT_ERROR');
    });

    it('should reject setting the category as its own parent', async () => {
      const created = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Loop' })
        .expect(201);

      await request(app)
        .patch(`/categories/${created.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .send({ parentId: created.body.id })
        .expect(400);
    });

    it('should detach a child back to the root', async () => {
      const parent = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Parent' })
        .expect(201);
      const child = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Child',
          parentId: parent.body.id,
        })
        .expect(201);

      const response = await request(app)
        .patch(`/categories/${child.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .send({ parentId: null })
        .expect(200);

      expect(response.body).toMatchObject({ parentId: null });
    });
  });

  describe('DELETE /categories/:id', () => {
    it('should delete the category and cascade its children', async () => {
      const parent = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({ organizationId: member.organizationId, name: 'Parent' })
        .expect(201);
      const child = await request(app)
        .post('/categories')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Child',
          parentId: parent.body.id,
        })
        .expect(201);

      await request(app)
        .delete(`/categories/${parent.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(204);

      await request(app)
        .get(`/categories/${child.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(404);
    });

    it('should return 404 when deleting another organization category', async () => {
      const foreign = await request(app)
        .post('/categories')
        .set(auth(admin.accessToken))
        .send({
          organizationId: outsider.organizationId,
          name: 'Foreign',
        })
        .expect(201);

      await request(app)
        .delete(`/categories/${foreign.body.id}`)
        .query(orgQuery(member.organizationId))
        .set(auth(member.accessToken))
        .expect(404);
    });
  });
});
