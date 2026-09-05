import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { authenticate } from '../../src/middlewares/authenticate.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';
import { requirePermission } from '../../src/middlewares/require-permission.js';
import { setupRoutes } from '../../src/routes.js';
import {
  createTestUser,
  grantPermission,
  resetDatabase,
} from '../helpers/db.js';

const hasTestDb =
  (globalThis as { __INVBIZ_TEST_DB__?: boolean }).__INVBIZ_TEST_DB__ === true;

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

function refreshCookie(response: request.Response): string {
  const cookie = setCookies(response).find((c) =>
    c.startsWith('refreshToken='),
  );
  expect(cookie).toBeDefined();
  return cookie!.split(';')[0]!;
}

/**
 * Mirrors `createApp()` wiring (JSON, cookies, real routes, central
 * error handler) with an additional scratch protected route, registered
 * before the error handler so 401/403s serialize as JSON. Used to cover
 * `authenticate` + `requirePermission` end to end without shipping a
 * test-only route in production.
 */
function createProtectedTestApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(cookieParser());

  setupRoutes(app);

  app.get(
    '/protected',
    authenticate,
    requirePermission('things:read'),
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );

  app.use(errorHandler);

  return app;
}

describe.skipIf(!hasTestDb)('auth endpoints', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /auth/login', () => {
    it('should return tokens and set the refresh cookie', async () => {
      const { user, password } = await createTestUser({
        email: 'login@example.com',
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');

      const cookies = setCookies(response);
      const cookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).not.toContain('Secure');
    });

    it('should reject an unknown email with INVALID_CREDENTIALS', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject a wrong password with INVALID_CREDENTIALS', async () => {
      const { user } = await createTestUser({ email: 'login@example.com' });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject a missing password with VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'login@example.com' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate body-transport tokens and reject the old one', async () => {
      const { user, password } = await createTestUser({
        email: 'refresh@example.com',
      });

      const login = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      const rotated = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);

      expect(typeof rotated.body.accessToken).toBe('string');
      expect(typeof rotated.body.refreshToken).toBe('string');
      expect(rotated.body.refreshToken).not.toBe(login.body.refreshToken);

      const reuse = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);

      expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should accept the cookie-transport token and set a new cookie', async () => {
      const { user, password } = await createTestUser({
        email: 'cookie@example.com',
      });

      const login = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      const rotated = await request(app)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(login))
        .send({})
        .expect(200);

      expect(typeof rotated.body.refreshToken).toBe('string');

      const cookie = setCookies(rotated).find((c) =>
        c.startsWith('refreshToken='),
      );
      expect(cookie).toContain('HttpOnly');
    });

    it('should reject a missing token with 400', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST_ERROR');
    });

    it('should reject a tampered token with INVALID_REFRESH_TOKEN', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'tampered-token' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke the token, clear the cookie, and reject later use', async () => {
      const { user, password } = await createTestUser({
        email: 'logout@example.com',
      });

      const login = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      const logout = await request(app)
        .post('/auth/logout')
        .set('Cookie', refreshCookie(login))
        .send({})
        .expect(204);

      const cleared = setCookies(logout).find((c) =>
        c.startsWith('refreshToken=;'),
      );
      expect(cleared).toBeDefined();

      const reuse = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);

      expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should accept body-transport logout', async () => {
      const { user, password } = await createTestUser({
        email: 'logout-body@example.com',
      });

      const login = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);

      await request(app)
        .post('/auth/logout')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });

    it('should still return 204 when no token is provided', async () => {
      await request(app).post('/auth/logout').send({}).expect(204);
    });
  });
});

describe.skipIf(!hasTestDb)('protected route middleware', () => {
  const app = createProtectedTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  async function loginAs(overrides: Parameters<typeof createTestUser>[0] = {}) {
    const { user, password } = await createTestUser({
      email: 'protected@example.com',
      ...overrides,
    });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    return { user, accessToken: login.body.accessToken as string };
  }

  it('should reject a missing token with MISSING_ACCESS_TOKEN', async () => {
    const response = await request(app).get('/protected').expect(401);

    expect(response.body.error.code).toBe('MISSING_ACCESS_TOKEN');
  });

  it('should reject a user without the permission', async () => {
    const { accessToken } = await loginAs();

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should allow a user after the permission is granted', async () => {
    const { user, accessToken } = await loginAs();
    await grantPermission(user.id, 'things:read');

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({ ok: true });
  });

  it('should allow an admin without any grant', async () => {
    const { accessToken } = await loginAs({
      email: 'admin@example.com',
      accessLevel: 'admin',
    });

    await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
