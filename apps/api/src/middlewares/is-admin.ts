import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

export function isAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw createError(401, 'Authentication is required.', {
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    if (req.user.accessLevel !== 'admin') {
      throw createError(403, 'Insufficient permissions.', {
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
