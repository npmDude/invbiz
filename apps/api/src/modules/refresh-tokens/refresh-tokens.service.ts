import { and, eq, type SQL } from 'drizzle-orm';

import { db, type Database } from '../../database';
import type { RefreshToken } from '../../database/schemas/refresh-tokens';
import { refreshTokensTable } from '../../database/schemas/refresh-tokens';
import { Service } from '../../shared/service';

export type RefreshTokenFilters = {
  id?: string;
  userId?: string;
};

export type CreateRefreshTokenInput = {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
};

export class RefreshTokensService extends Service<
  RefreshTokenFilters,
  RefreshToken,
  CreateRefreshTokenInput
> {
  constructor(database: Database) {
    super({
      db: database,
      table: refreshTokensTable,
      resourceName: 'Refresh token',
    });
  }

  protected buildFilters(filters?: RefreshTokenFilters): SQL | undefined {
    if (!filters) {
      return undefined;
    }

    const conditions: SQL[] = [];

    if (filters.id) {
      conditions.push(eq(refreshTokensTable.id, filters.id));
    }

    if (filters.userId) {
      conditions.push(eq(refreshTokensTable.userId, filters.userId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  revoke(id: string) {
    return this.update(id, { revokedAt: new Date() });
  }
}

export const refreshTokensService = new RefreshTokensService(db);
