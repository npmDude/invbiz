import type { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';

export function requirePermission(permissions: string | string[]) {
  const required = Array.isArray(permissions) ? permissions : [permissions];

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    const allowed = await authService.hasPermissions(req.user, required);

    if (!allowed) {
      return res.status(403).json({
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}
