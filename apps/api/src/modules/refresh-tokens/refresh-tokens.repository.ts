import { and, eq, type SQL } from 'drizzle-orm';
import { db, type Database } from '../../database';
import { refreshTokensTable } from '../../database/schemas/refresh-tokens';
import { BaseRepository } from '../../shared/base.repository';

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

export class RefreshTokensRepository extends BaseRepository<
  typeof refreshTokensTable,
  RefreshTokenFilters,
  CreateRefreshTokenInput
> {
  constructor(db: Database) {
    super(db, refreshTokensTable);
  }

  protected buildFilters(filters?: RefreshTokenFilters) {
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
}

export const refreshTokensRepository = new RefreshTokensRepository(db);
