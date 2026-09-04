import { describe, expect, it } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './auth.jwt';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const jti = '660e8400-e29b-41d4-a716-446655440000';

describe('auth.jwt', () => {
  describe('signAccessToken', () => {
    it('should create a valid access token', async () => {
      const token = await signAccessToken(userId);

      expect(token).toEqual(expect.any(String));
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include the user ID and access token type', async () => {
      const token = await signAccessToken(userId);

      const payload = await verifyAccessToken(token);

      expect(payload.sub).toBe(userId);
      expect(payload.type).toBe('access');
    });

    it('should include issued-at and expiration claims', async () => {
      const token = await signAccessToken(userId);

      const payload = await verifyAccessToken(token);

      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));
      expect(payload.exp).toBeGreaterThan(payload.iat!);
    });
  });

  describe('verifyAccessToken', () => {
    it('should reject an invalid token', async () => {
      await expect(verifyAccessToken('invalid-token')).rejects.toThrow();
    });

    it('should reject a token with an invalid signature', async () => {
      const token = await signAccessToken(userId);
      const tamperedToken = `${token}tampered`;

      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow();
    });
  });

  describe('signRefreshToken', () => {
    it('should create a valid refresh token', async () => {
      const token = await signRefreshToken(userId, jti);

      expect(token).toEqual(expect.any(String));
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include the user ID, refresh token type, and jti', async () => {
      const token = await signRefreshToken(userId, jti);

      const payload = await verifyRefreshToken(token);

      expect(payload.sub).toBe(userId);
      expect(payload.type).toBe('refresh');
      expect(payload.jti).toBe(jti);
    });

    it('should include issued-at and expiration claims', async () => {
      const token = await signRefreshToken(userId, jti);

      const payload = await verifyRefreshToken(token);

      expect(payload.iat).toEqual(expect.any(Number));
      expect(payload.exp).toEqual(expect.any(Number));
      expect(payload.exp).toBeGreaterThan(payload.iat!);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should reject an invalid token', async () => {
      await expect(verifyRefreshToken('invalid-token')).rejects.toThrow();
    });

    it('should reject a token with an invalid signature', async () => {
      const token = await signRefreshToken(userId, jti);
      const tamperedToken = `${token}tampered`;

      await expect(verifyRefreshToken(tamperedToken)).rejects.toThrow();
    });

    it('should reject an access token', async () => {
      const token = await signAccessToken(userId);

      await expect(verifyRefreshToken(token)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
