import type { User } from '../../database/schemas/users';
import { BaseService } from '../../shared/base.service';
import {
  usersRepository,
  type UserFilters,
  type UsersRepository,
} from './users.repository';

export class UsersService extends BaseService<
  UserFilters,
  User,
  UsersRepository
> {
  findPermissionKeys(userId: string) {
    return this.repository.findPermissionKeys(userId);
  }
}

export const usersService = new UsersService(usersRepository);
