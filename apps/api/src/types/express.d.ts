import type { SafeUser } from '../modules/users/users.service';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

export {};
