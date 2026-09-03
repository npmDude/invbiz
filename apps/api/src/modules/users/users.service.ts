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
  constructor(repository: UsersRepository) {
    super(repository);
  }
}

export const usersService = new UsersService(usersRepository);
