import bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { User } from '../../database/schemas/users';
import { AppError } from '../../lib/app-error';
import { promiseAll } from '../../lib/promise-all';
import {
  refreshTokensService,
  type RefreshTokensService,
} from '../refresh-tokens/refresh-tokens.service';
import { usersService, type UsersService } from '../users/users.service';
import {
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './auth.jwt';
import type { LoginBody } from './auth.schema';

export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async hasPermissions(user: User, requiredPermissions: string[]) {
    if (user.accessLevel === 'admin' || user.accessLevel === 'superuser') {
      return true;
    }

    const permissions = new Set(
      await this.usersService.findPermissionKeys(user.id),
    );

    return requiredPermissions.every((permission) =>
      permissions.has(permission),
    );
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }

  async login({ email, password }: LoginBody) {
    const user = await this.usersService.findOne({ email });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const valid = await this.verifyPassword(password, user.password);

    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const [accessToken, refreshToken] = await promiseAll([
      { label: 'accessToken', promise: () => signAccessToken(user.id) },
      {
        label: 'refreshToken',
        promise: () => this.createRefreshToken(user.id),
      },
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenHashesMatch(token: string, expectedHash: string) {
    const actual = Buffer.from(this.hashToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private invalidRefreshToken() {
    return new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  async createRefreshToken(userId: string) {
    const id = randomUUID();
    const token = await signRefreshToken(userId, id);

    await this.refreshTokensService.create({
      id,
      userId,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return token;
  }

  async rotateRefreshToken(token: string) {
    let payload;

    try {
      payload = await verifyRefreshToken(token);
    } catch {
      throw this.invalidRefreshToken();
    }

    const record = await this.refreshTokensService.findById(payload.jti);

    if (
      !record ||
      record.userId !== payload.sub ||
      !this.tokenHashesMatch(token, record.tokenHash)
    ) {
      throw this.invalidRefreshToken();
    }

    if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      throw this.invalidRefreshToken();
    }

    await this.refreshTokensService.revoke(record.id);

    const [accessToken, refreshToken] = await promiseAll([
      { label: 'accessToken', promise: () => signAccessToken(record.userId) },
      {
        label: 'refreshToken',
        promise: () => this.createRefreshToken(record.userId),
      },
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async revokeRefreshToken(token: string) {
    let payload;

    try {
      payload = await verifyRefreshToken(token);
    } catch {
      throw this.invalidRefreshToken();
    }

    const record = await this.refreshTokensService.findById(payload.jti);

    if (
      !record ||
      record.userId !== payload.sub ||
      !this.tokenHashesMatch(token, record.tokenHash)
    ) {
      throw this.invalidRefreshToken();
    }

    await this.refreshTokensService.revoke(record.id);
  }
}

export const authService = new AuthService(usersService, refreshTokensService);
