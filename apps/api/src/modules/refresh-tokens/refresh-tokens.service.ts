import type { RefreshToken } from '../../database/schemas/refresh-tokens';
import { BaseService } from '../../shared/base.service';
import {
  refreshTokensRepository,
  type RefreshTokenFilters,
  type RefreshTokensRepository,
} from './refresh-tokens.repository';

export class RefreshTokensService extends BaseService<
  RefreshTokenFilters,
  RefreshToken,
  RefreshTokensRepository
> {
  constructor(repository: RefreshTokensRepository) {
    super(repository);
  }

  revoke(id: string) {
    return this.update(id, { revokedAt: new Date() });
  }
}

export const refreshTokensService = new RefreshTokensService(
  refreshTokensRepository,
);
