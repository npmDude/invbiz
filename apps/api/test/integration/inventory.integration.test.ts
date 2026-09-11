import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { db } from '../../src/database/index.js';
import { usersBranchesTable } from '../../src/database/schemas/users-branches.js';
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

describe.skipIf(!hasTestDb)('inventory endpoints', () => {
  const app = createApp();

  let member: Actor;

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeEach(async () => {
    await resetDatabase();

    const organization = await createTestOrganization('Inventory Org');
    member = await loginAs(app, {
      email: 'inventory-member@example.com',
      organizationId: organization.id,
    });
    await grantPermission(member.userId, 'products.view');
    await grantPermission(member.userId, 'products.create');
    await grantPermission(member.userId, 'products.manage');
    await grantPermission(member.userId, 'categories.view');
    await grantPermission(member.userId, 'categories.create');
    await grantPermission(member.userId, 'branches.view');
    await grantPermission(member.userId, 'branches.create');
    await grantPermission(member.userId, 'inventory.view');
    await grantPermission(member.userId, 'inventory.create');
    await grantPermission(member.userId, 'inventory.manage');
  });

  async function createCategory(name: string) {
    const response = await request(app)
      .post('/categories')
      .set(auth(member.accessToken))
      .send({ organizationId: member.organizationId, name })
      .expect(201);
    return response.body as { id: string };
  }

  async function createBranch(name: string) {
    const response = await request(app)
      .post('/branches')
      .set(auth(member.accessToken))
      .send({ organizationId: member.organizationId, name, address: 'Addr' })
      .expect(201);
    return response.body as { id: string };
  }

  async function assignBranch(userId: string, branchId: string) {
    await db.insert(usersBranchesTable).values({ userId, branchId });
  }

  describe('POST /products with branchPrices', () => {
    it('should create zero-quantity inventory rows for selected branches', async () => {
      const category = await createCategory('Beverages');
      const branch = await createBranch('Main');

      const response = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Coke 500ml',
          code: 'COKE-500',
          supplierPrice: 1.5,
          categoryIds: [category.id],
          branchPrices: [{ branchId: branch.id, salePrice: 2.5 }],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Coke 500ml',
        branchPrices: [{ branchId: branch.id, quantity: 0 }],
      });
    });

    it('should reject a branch from another organization', async () => {
      const category = await createCategory('Beverages');
      const foreignOrg = await createTestOrganization('Foreign Org');

      const { user: adminUser } = await createTestUser({
        email: 'inventory-admin@example.com',
        accessLevel: 'admin',
      });
      const login = await request(app)
        .post('/auth/login')
        .send({ email: adminUser.email, password: 'correct-password' })
        .expect(200);
      const adminToken = login.body.accessToken as string;
      const foreignCreated = await request(app)
        .post('/branches')
        .set(auth(adminToken))
        .send({
          organizationId: foreignOrg.id,
          name: 'Foreign',
          address: 'Addr',
        })
        .expect(201);

      const response = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Bad Branch',
          code: 'BAD-001',
          supplierPrice: 1,
          categoryIds: [category.id],
          branchPrices: [
            {
              branchId: (foreignCreated.body as { id: string }).id,
              salePrice: 2,
            },
          ],
        })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST_ERROR');
    });
  });

  describe('GET /inventory', () => {
    it('should list inventory for an assigned branch', async () => {
      const category = await createCategory('Beverages');
      const branch = await createBranch('Main');
      await assignBranch(member.userId, branch.id);

      const created = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Coke 500ml',
          code: 'COKE-500',
          supplierPrice: 1.5,
          categoryIds: [category.id],
          branchPrices: [{ branchId: branch.id, salePrice: 2.5 }],
        })
        .expect(201);

      const response = await request(app)
        .get('/inventory')
        .query({ organizationId: member.organizationId, branchId: branch.id })
        .set(auth(member.accessToken))
        .expect(200);

      expect(response.body).toMatchObject([
        {
          branchId: branch.id,
          productId: (created.body as { id: string }).id,
          quantity: 0,
          salePrice: '2.50',
        },
      ]);
    });

    it('should reject querying an unassigned branch', async () => {
      const branch = await createBranch('Main');

      await request(app)
        .get('/inventory')
        .query({ organizationId: member.organizationId, branchId: branch.id })
        .set(auth(member.accessToken))
        .expect(403);
    });
  });

  describe('POST /inventory', () => {
    async function createProduct(branchId: string) {
      const category = await createCategory('Beverages');
      const created = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Coke 500ml',
          code: 'COKE-500',
          supplierPrice: 1.5,
          categoryIds: [category.id],
          branchPrices: [{ branchId, salePrice: 2.5 }],
        })
        .expect(201);
      return (created.body as { id: string }).id;
    }

    it('should stock an existing product in a new branch with zero quantity', async () => {
      const stocked = await createBranch('Main');
      const productId = await createProduct(stocked.id);
      const added = await createBranch('North');
      await assignBranch(member.userId, added.id);

      const response = await request(app)
        .post('/inventory')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: added.id,
          productId,
          salePrice: 3,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        branchId: added.id,
        productId,
        quantity: 0,
        salePrice: '3.00',
      });
    });

    it('should accept an opening quantity', async () => {
      const stocked = await createBranch('Main');
      const productId = await createProduct(stocked.id);
      const added = await createBranch('North');
      await assignBranch(member.userId, added.id);

      const response = await request(app)
        .post('/inventory')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: added.id,
          productId,
          salePrice: 3,
          quantity: 12,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        branchId: added.id,
        productId,
        quantity: 12,
        salePrice: '3.00',
      });
    });

    it('should reject a negative quantity', async () => {
      const branch = await createBranch('Main');
      const productId = await createProduct(branch.id);

      await request(app)
        .post('/inventory')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: branch.id,
          productId,
          salePrice: 3,
          quantity: -1,
        })
        .expect(400);
    });

    it('should reject a duplicate branch and product', async () => {
      const branch = await createBranch('Main');
      await assignBranch(member.userId, branch.id);
      const productId = await createProduct(branch.id);

      await request(app)
        .post('/inventory')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: branch.id,
          productId,
          salePrice: 3,
        })
        .expect(409);
    });

    it('should reject a branch from another organization', async () => {
      const branch = await createBranch('Main');
      const productId = await createProduct(branch.id);
      const foreignOrg = await createTestOrganization('Foreign Org');

      const { user: adminUser } = await createTestUser({
        email: 'inventory-foreign-admin@example.com',
        accessLevel: 'admin',
      });
      const adminLogin = await request(app)
        .post('/auth/login')
        .send({ email: adminUser.email, password: 'correct-password' })
        .expect(200);
      const foreignCreated = await request(app)
        .post('/branches')
        .set(auth(adminLogin.body.accessToken as string))
        .send({
          organizationId: foreignOrg.id,
          name: 'Foreign',
          address: 'Addr',
        })
        .expect(201);

      await request(app)
        .post('/inventory')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: (foreignCreated.body as { id: string }).id,
          productId,
          salePrice: 3,
        })
        .expect(404);
    });

    it('should require the inventory.create permission', async () => {
      const branch = await createBranch('Main');
      const productId = await createProduct(branch.id);
      const viewer = await loginAs(app, {
        email: 'inventory-viewer@example.com',
        organizationId: member.organizationId as string,
      });
      await grantPermission(viewer.userId, 'inventory.view');
      await grantPermission(viewer.userId, 'products.view');

      await request(app)
        .post('/inventory')
        .set(auth(viewer.accessToken))
        .send({
          organizationId: member.organizationId,
          branchId: branch.id,
          productId,
          salePrice: 3,
        })
        .expect(403);
    });
  });

  describe('PATCH /inventory', () => {
    it('should update the sale price for an assigned branch', async () => {
      const category = await createCategory('Beverages');
      const branch = await createBranch('Main');
      await assignBranch(member.userId, branch.id);

      const created = await request(app)
        .post('/products')
        .set(auth(member.accessToken))
        .send({
          organizationId: member.organizationId,
          name: 'Coke 500ml',
          code: 'COKE-500',
          supplierPrice: 1.5,
          categoryIds: [category.id],
          branchPrices: [{ branchId: branch.id, salePrice: 2.5 }],
        })
        .expect(201);
      const productId = (created.body as { id: string }).id;

      const response = await request(app)
        .patch(`/inventory/${branch.id}/${productId}`)
        .query({ organizationId: member.organizationId })
        .set(auth(member.accessToken))
        .send({ salePrice: 3.75 })
        .expect(200);

      expect(response.body).toMatchObject({
        branchId: branch.id,
        productId,
        quantity: 0,
        salePrice: '3.75',
      });
    });
  });
});
