import type { User } from '../database/schemas/users';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
