import type { NextFunction, Request, Response } from 'express';

import createError from 'http-errors';
import type { SafeUser } from '../modules/users/users.service';
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

    let user: SafeUser;

    try {
      user = await usersService.findById(userId);
    } catch (error) {
      if (createError.isHttpError(error) && error.status === 404) {
        throw createError(401, 'Invalid access token.', {
          code: 'INVALID_ACCESS_TOKEN',
        });
      }

      throw error;
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Narrow `req.user` after `authenticate` has run. Throws 401 when no user is
 * present, sparing every handler its own auth-presence check.
 */
export function requireRequestUser(req: Request): SafeUser {
  if (!req.user) {
    throw createError(401, 'Authentication is required.', {
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  return req.user;
}
