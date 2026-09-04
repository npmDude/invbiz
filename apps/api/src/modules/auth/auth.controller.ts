import { Router, type Request } from 'express';
import { checkSchema } from '../../middlewares/check-schema';
import { loginBodySchema, type LoginBody } from './auth.schema';
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

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
