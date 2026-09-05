import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { authService } from '../modules/auth/auth.service';

export function requirePermission(permissions: string | string[]) {
  const required = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError(401, 'Authentication required.'));
    }

    const allowed = await authService.hasPermissions(req.user, required);

    if (!allowed) {
      return next(createError(403, 'Insufficient permissions.'));
    }

    next();
  };
}
