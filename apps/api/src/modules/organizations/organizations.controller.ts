import { Router, type Request } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { checkSchema } from '../../middlewares/check-schema';
import { isAdmin } from '../../middlewares/is-admin';
import { requireOrganizationMembership } from '../../middlewares/require-organization-membership';
import { registry } from '../../openapi/registry';
import {
  createOrganizationBodySchema,
  updateOrganizationBodySchema,
  type CreateOrganizationBody,
  type UpdateOrganizationBody,
} from './organizations.schema';
import { organizationsService } from './organizations.service';

const router = Router();

router.use(authenticate);

registry.registerPath({
  method: 'get',
  path: '/organizations',
  tags: ['Organizations'],
  summary: 'List organizations',
  responses: {
    200: {
      description: 'Organizations retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
  },
});

router.get('/', isAdmin, async (_req, res, next) => {
  try {
    const organizations = await organizationsService.findAll();

    return res.status(200).json(organizations);
  } catch (error) {
    next(error);
  }
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Get an organization',
  responses: {
    200: {
      description: 'Organization retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

router.get(
  '/:id',
  requireOrganizationMembership('params'),
  async (req: Request<{ id: string }>, res, next) => {
    try {
      const organization = await organizationsService.findById(req.params.id);

      return res.status(200).json(organization);
    } catch (error) {
      next(error);
    }
  },
);

registry.registerPath({
  method: 'post',
  path: '/organizations',
  tags: ['Organizations'],
  summary: 'Create an organization',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createOrganizationBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Organization created',
    },
    400: {
      description: 'Invalid request',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
  },
});

router.post(
  '/',
  isAdmin,
  checkSchema({ bodySchema: createOrganizationBodySchema }),
  async (
    req: Request<Record<string, never>, unknown, CreateOrganizationBody>,
    res,
    next,
  ) => {
    try {
      const organization = await organizationsService.create(req.body);

      return res.status(201).json(organization);
    } catch (error) {
      next(error);
    }
  },
);

registry.registerPath({
  method: 'patch',
  path: '/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Update an organization',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateOrganizationBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Organization updated',
    },
    400: {
      description: 'Invalid request',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

router.patch(
  '/:id',
  requireOrganizationMembership('params'),
  checkSchema({ bodySchema: updateOrganizationBodySchema }),
  async (
    req: Request<{ id: string }, unknown, UpdateOrganizationBody>,
    res,
    next,
  ) => {
    try {
      const data = req.body.name === undefined ? {} : { name: req.body.name };

      const organization = await organizationsService.update(
        req.params.id,
        data,
      );

      return res.status(200).json(organization);
    } catch (error) {
      next(error);
    }
  },
);

registry.registerPath({
  method: 'delete',
  path: '/organizations/{id}',
  tags: ['Organizations'],
  summary: 'Delete an organization',
  responses: {
    204: {
      description: 'Organization deleted',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

router.delete(
  '/:id',
  isAdmin,
  async (req: Request<{ id: string }>, res, next) => {
    try {
      await organizationsService.delete(req.params.id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

export default router;
