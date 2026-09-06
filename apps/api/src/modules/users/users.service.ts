import createError from 'http-errors';

import { usersTable, type User } from '../../database/schemas/users';
import { BaseService } from '../../shared/base.service';
import {
  usersRepository,
  type UserFilters,
  type UsersRepository,
} from './users.repository';

export type SafeUser = Omit<User, 'password'>;

export type CreateUserInput = typeof usersTable.$inferInsert;

export function toSafeUser(user: User): SafeUser {
  const { password: _password, ...safeUser } = user;
  void _password;
  return safeUser;
}

export class UsersService extends BaseService<
  UserFilters,
  SafeUser,
  UsersRepository
> {
  async findAll(filters?: UserFilters): Promise<SafeUser[]> {
    const users = await super.findAll(filters);
    return users.map((user) => toSafeUser(user as User));
  }

  async findOne(
    filters?: UserFilters,
    options?: { withPassword?: false },
  ): Promise<SafeUser | undefined>;
  async findOne(
    filters: UserFilters | undefined,
    options: { withPassword: true },
  ): Promise<User | undefined>;
  async findOne(
    filters?: UserFilters,
    options?: { withPassword?: boolean },
  ): Promise<SafeUser | User | undefined> {
    const user = await super.findOne(filters);

    if (!user) {
      return undefined;
    }

    return options?.withPassword ? user : toSafeUser(user as User);
  }

  async findById(id: string, scope?: UserFilters): Promise<SafeUser> {
    const user = await super.findById(id, scope);
    return toSafeUser(user as User);
  }

  async create(data: CreateUserInput): Promise<SafeUser> {
    const user = await super.create(data);
    return toSafeUser(user as User);
  }

  async update(
    id: string,
    data: Partial<CreateUserInput>,
    scope?: UserFilters,
  ): Promise<SafeUser> {
    const user = await super.update(id, data, scope);

    return toSafeUser(user as User);
  }

  async delete(id: string, scope?: UserFilters): Promise<SafeUser> {
    await this.findById(id, scope);

    const user = await this.repository.delete(id);

    if (!user) {
      throw createError(404, 'User not found.');
    }

    return toSafeUser(user);
  }

  findPermissionKeys(userId: string) {
    return this.repository.findPermissionKeys(userId);
  }
}

export const usersService = new UsersService(usersRepository, 'User');
