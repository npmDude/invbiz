import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { authService } from '../modules/auth/auth.service';

export function requirePermission(permissions: string | string[]) {
  const required = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError(401, 'Authentication is required.', {
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const allowed = await authService.hasPermissions(req.user, required);

      if (!allowed) {
        throw createError(403, 'Insufficient permissions.', {
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
