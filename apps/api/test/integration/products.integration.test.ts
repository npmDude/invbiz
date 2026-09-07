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

describe.skipIf(!hasTestDb)('products endpoints', () => {
  const app = createApp();

  let admin: Actor;
  let member: Actor;

  beforeEach(async () => {
    await resetDatabase();

    admin = await loginAs(app, {
      email: 'products-admin@example.com',
      accessLevel: 'admin',
    });

    const organization = await createTestOrganization('Products Org');
    member = await loginAs(app, {
      email: 'products-member@example.com',
      organizationId: organization.id,
    });
    await grantPermission(member.userId, 'products.view');
    await grantPermission(member.userId, 'products.create');
    await grantPermission(member.userId, 'products.manage');
    await grantPermission(member.userId, 'categories.view');
    await grantPermission(member.userId, 'categories.create');
    await grantPermission(member.userId, 'categories.manage');
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createCategory(
    name: string,
    organizationId: string,
    token: string,
  ) {
    const response = await request(app)
      .post('/categories')
      .set(auth(token))
      .send({ organizationId, name })
      .expect(201);
    return response.body as { id: string };
  }

  describe('POST /products', () => {
    it('should create a product with a category', async () => {
      const category = await createCategory(
        'Beverages',
        member.organizationId as string,
        member.accessToken,
      );

      const response = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Coke 500ml',
          code: 'COKE-500',
          supplierPrice: 1.5,
          categoryIds: [category.id],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Coke 500ml',
        code: 'COKE-500',
        supplierPrice: '1.50',
        categoryIds: [category.id],
      });
    });

    it('should reject creation without categories', async () => {
      const response = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Lonely',
          code: 'LON-001',
          supplierPrice: 2,
          categoryIds: [],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject a duplicate code within the same organization', async () => {
      const category = await createCategory(
        'Food',
        member.organizationId as string,
        member.accessToken,
      );
      const payload = {
        organizationId: member.organizationId,
        name: 'Widget',
        code: 'W-001',
        supplierPrice: 5,
        categoryIds: [category.id],
      };

      await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send(payload)
        .expect(201);

      await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({ ...payload, name: 'Widget 2' })
        .expect(409);
    });

    it('should reject a category from another organization', async () => {
      const foreignOrg = await createTestOrganization('Foreign Org');
      const foreign = await createCategory(
        'Foreign',
        foreignOrg.id,
        admin.accessToken,
      );

      const response = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Hijack',
          code: 'HIJ-001',
          supplierPrice: 3,
          categoryIds: [foreign.id],
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST_ERROR');
    });
  });

  describe('GET /products', () => {
    it('should list only the requested organization products', async () => {
      const category = await createCategory(
        'Snacks',
        member.organizationId as string,
        member.accessToken,
      );

      await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Chips',
          code: 'CHP-001',
          supplierPrice: 2.25,
          categoryIds: [category.id],
        })
        .expect(201);

      const response = await request(app)
        .get('/products')
        .query({ organizationId: member.organizationId })
        .set(auth(member.accessToken))
        .expect(200);

      expect(response.body.map((p: { code: string }) => p.code)).toEqual([
        'CHP-001',
      ]);
    });
  });

  describe('DELETE /categories with products', () => {
    it('should reject deleting the last category of a product', async () => {
      const category = await createCategory(
        'Solo',
        member.organizationId as string,
        member.accessToken,
      );

      await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Solo Product',
          code: 'SOLO-001',
          supplierPrice: 9.99,
          categoryIds: [category.id],
        })
        .expect(201);

      await request(app)
        .delete(`/categories/${category.id}`)
        .query({ organizationId: member.organizationId })
        .set(auth(member.accessToken))
        .expect(400);
    });
  });
});
