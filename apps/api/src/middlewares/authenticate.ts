import type { NextFunction, Request, Response } from 'express';

import createError from 'http-errors';
import { verifyAccessToken } from '../modules/auth/auth.jwt';
import { usersService } from '../modules/users/users.service';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw createError(401, 'An access token bearer is required.', {
        code: 'MISSING_ACCESS_TOKEN',
      });
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw createError(401, 'An access token bearer is required.', {
        code: 'MISSING_ACCESS_TOKEN',
      });
    }

    let userId: string;

    try {
      ({ sub: userId } = await verifyAccessToken(token));
    } catch {
      throw createError(401, 'Invalid access token.', {
        code: 'INVALID_ACCESS_TOKEN',
      });
    }

    const user = await usersService.findById(userId);

    if (!user) {
      throw createError(401, 'Invalid access token.', {
        code: 'INVALID_ACCESS_TOKEN',
      });
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}
