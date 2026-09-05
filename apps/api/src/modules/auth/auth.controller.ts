import { Router, type Request } from 'express';
import createError from 'http-errors';
import { checkSchema } from '../../middlewares/check-schema';
import {
  clearRefreshTokenCookie,
  resolveRefreshToken,
  setRefreshTokenCookie,
} from './auth.cookies';
import { loginBodySchema, refreshBodySchema } from './auth.schema';
import type { LoginBody, RefreshBody } from './auth.schema';
import { authService } from './auth.service';
import { registry } from '../../openapi/registry';

const router = Router();

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Login',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: loginBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
    },
    400: {
      description: 'Invalid request',
    },
    401: {
      description: 'Invalid credentials',
    },
  },
});

router.post(
  '/login',
  checkSchema({ bodySchema: loginBodySchema }),
  async (
    req: Request<Record<string, never>, unknown, LoginBody>,
    res,
    next,
  ) => {
    try {
      const result = await authService.login(req.body);

      setRefreshTokenCookie(res, result.refreshToken);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh tokens',
  description:
    'Accepts the refresh token as an HttpOnly cookie (browser clients) or in the request body (mobile and other API clients).',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: refreshBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed',
    },
    400: {
      description: 'Invalid request',
    },
    401: {
      description: 'Invalid refresh token',
    },
  },
});

router.post(
  '/refresh',
  checkSchema({ bodySchema: refreshBodySchema }),
  async (
    req: Request<Record<string, never>, unknown, RefreshBody>,
    res,
    next,
  ) => {
    try {
      const refreshToken = resolveRefreshToken(req);

      if (!refreshToken) {
        throw createError(
          400,
          'A refresh token cookie or body field is required.',
        );
      }

      const result = await authService.rotateRefreshToken(refreshToken);

      setRefreshTokenCookie(res, result.refreshToken);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Logout',
  description:
    'Accepts the refresh token as an HttpOnly cookie (browser clients) or in the request body (mobile and other API clients).',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: refreshBodySchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: 'Logged out',
    },
    400: {
      description: 'Invalid request',
    },
    401: {
      description: 'Invalid refresh token',
    },
  },
});

router.post(
  '/logout',
  checkSchema({ bodySchema: refreshBodySchema }),
  async (
    req: Request<Record<string, never>, unknown, RefreshBody>,
    res,
    next,
  ) => {
    try {
      const refreshToken = resolveRefreshToken(req);

      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      clearRefreshTokenCookie(res);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
