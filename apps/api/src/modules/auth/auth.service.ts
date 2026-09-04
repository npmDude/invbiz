import bcrypt from 'bcrypt';
import type { User } from '../../database/schemas/users';
import { signAccessToken } from './auth.jwt';
import type { LoginBody } from './auth.schema';
import { usersService, type UsersService } from '../users/users.service';

export class AuthService {
  constructor(private readonly usersService: UsersService) {}

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

    const accessToken = await signAccessToken(user.id);

    return {
      accessToken,
    };
  }
}

export const authService = new AuthService(usersService);
