import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import createError from 'http-errors';

import type { RefreshToken } from '../../database/schemas/refresh-tokens';
import type { User } from '../../database/schemas/users';
import type { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service';
import type { UsersService } from '../users/users.service';
import {
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './auth.jwt';
import { AuthService } from './auth.service';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const passwordHash = await bcrypt.hash('correct-password', 4);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    organizationId: null,
    name: 'Test User',
    email: 'test@example.com',
    password: passwordHash,
    accessLevel: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const records = new Map<string, RefreshToken>();

  const usersService = {
    findOne: vi.fn(),
    findPermissionKeys: vi.fn(),
  } as unknown as UsersService;

  const refreshTokensService = {
    create: vi.fn(
      async (input: {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
      }) => {
        const record: RefreshToken = {
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };
        records.set(record.id, record);
        return record;
      },
    ),
    findById: vi.fn(async (id: string) => {
      const record = records.get(id);

      if (!record) {
        throw createError(404, 'Refresh token not found.');
      }

      return record;
    }),
    revoke: vi.fn(async (id: string) => {
      records.get(id)!.revokedAt = new Date();
    }),
  } as unknown as RefreshTokensService;

  const service = new AuthService(usersService, refreshTokensService);

  return {
    records,
    findOne: vi.mocked(usersService.findOne),
    findPermissionKeys: vi.mocked(usersService.findPermissionKeys),
    service,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should issue an access token and refresh token for valid credentials', async () => {
      const { findOne, records, service } = setup();
      const user = makeUser();
      findOne.mockResolvedValue(user);

      const result = await service.login({
        email: user.email,
        password: 'correct-password',
      });

      const access = await verifyAccessToken(result.accessToken);
      expect(access.sub).toBe(user.id);

      const refresh = await verifyRefreshToken(result.refreshToken);
      expect(refresh.sub).toBe(user.id);
      expect(records.get(refresh.jti)?.userId).toBe(user.id);
    });

    it('should reject an unknown email with 401', async () => {
      const { findOne, service } = setup();
      findOne.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('should reject a wrong password with 401', async () => {
      const { findOne, service } = setup();
      findOne.mockResolvedValue(makeUser());

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('rotateRefreshToken', () => {
    it('should revoke the old token and issue a new pair', async () => {
      const { records, service } = setup();
      const user = makeUser();

      const first = await service.createRefreshToken(user.id);
      const rotated = await service.rotateRefreshToken(first);

      const oldJti = (await verifyRefreshToken(first)).jti;
      expect(records.get(oldJti)?.revokedAt).not.toBeNull();

      const newJti = (await verifyRefreshToken(rotated.refreshToken)).jti;
      expect(newJti).not.toBe(oldJti);
      expect(records.get(newJti)?.revokedAt).toBeNull();

      const access = await verifyAccessToken(rotated.accessToken);
      expect(access.sub).toBe(user.id);
    });

    it('should reject a reused token after rotation', async () => {
      const { service } = setup();
      const user = makeUser();

      const first = await service.createRefreshToken(user.id);
      await service.rotateRefreshToken(first);

      await expect(service.rotateRefreshToken(first)).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should reject a tampered token', async () => {
      const { service } = setup();
      const user = makeUser();

      const token = await service.createRefreshToken(user.id);

      await expect(
        service.rotateRefreshToken(`${token}tampered`),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should reject an access token', async () => {
      const { service } = setup();
      const user = makeUser();

      const accessToken = await signAccessToken(user.id);

      await expect(
        service.rotateRefreshToken(accessToken),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should reject an expired token record', async () => {
      const { records, service } = setup();
      const user = makeUser();

      const token = await service.createRefreshToken(user.id);
      const jti = (await verifyRefreshToken(token)).jti;
      records.get(jti)!.expiresAt = new Date(Date.now() - 1000);

      await expect(service.rotateRefreshToken(token)).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should reject a token whose record belongs to another user', async () => {
      const { records, service } = setup();
      const user = makeUser();

      const token = await service.createRefreshToken(user.id);
      const jti = (await verifyRefreshToken(token)).jti;
      records.get(jti)!.userId = '770e8400-e29b-41d4-a716-446655440000';

      await expect(service.rotateRefreshToken(token)).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a valid token', async () => {
      const { records, service } = setup();
      const user = makeUser();

      const token = await service.createRefreshToken(user.id);
      await service.revokeRefreshToken(token);

      const jti = (await verifyRefreshToken(token)).jti;
      expect(records.get(jti)?.revokedAt).not.toBeNull();
    });

    it('should reject an unknown token with 401', async () => {
      const { service } = setup();

      await expect(
        service.revokeRefreshToken('not-a-token'),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  describe('hasPermissions', () => {
    it('should allow admins without checking the database', async () => {
      const { findPermissionKeys, service } = setup();

      await expect(
        service.hasPermissions(makeUser({ accessLevel: 'admin' }), [
          'anything',
        ]),
      ).resolves.toBe(true);
      expect(findPermissionKeys).not.toHaveBeenCalled();
    });

    it('should allow superusers without checking the database', async () => {
      const { findPermissionKeys, service } = setup();

      await expect(
        service.hasPermissions(makeUser({ accessLevel: 'superuser' }), [
          'anything',
        ]),
      ).resolves.toBe(true);
      expect(findPermissionKeys).not.toHaveBeenCalled();
    });

    it('should require every permission (AND semantics)', async () => {
      const { findPermissionKeys, service } = setup();
      const user = makeUser();
      findPermissionKeys.mockResolvedValue(['a', 'b']);

      await expect(service.hasPermissions(user, ['a', 'b'])).resolves.toBe(
        true,
      );
      await expect(service.hasPermissions(user, ['a', 'c'])).resolves.toBe(
        false,
      );
    });
  });
});
