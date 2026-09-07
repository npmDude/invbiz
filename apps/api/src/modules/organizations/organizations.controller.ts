import { ApiRouter } from '../../shared/api-router';
import { resolveScope } from '../../shared/scope';
import { isAdmin } from '../../middlewares/is-admin';
import {
  createOrganizationBodySchema,
  organizationIdParamsSchema,
  updateOrganizationBodySchema,
} from './organizations.schema';
import { organizationsService } from './organizations.service';

const api = new ApiRouter('/organizations');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List organizations',
  tags: ['Organizations'],
  middlewares: [isAdmin],
  handler: async () => {
    const organizations = await organizationsService.findAll();

    return organizations;
  },
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

api.endpoint({
  method: 'get',
  path: '/:id',
  summary: 'Get an organization',
  tags: ['Organizations'],
  paramsSchema: organizationIdParamsSchema,
  requiredPermission: 'organizations.view',
  handler: async ({ params, auth: { user: requester } }) => {
    resolveScope(requester, params.id);
    const organization = await organizationsService.findById(params.id);

    return organization;
  },
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

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Create an organization',
  tags: ['Organizations'],
  dataSchema: createOrganizationBodySchema,
  middlewares: [isAdmin],
  statusCode: 201,
  handler: async ({ data }) => {
    const organization = await organizationsService.create(data);

    return organization;
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

api.endpoint({
  method: 'patch',
  path: '/:id',
  summary: 'Update an organization',
  tags: ['Organizations'],
  paramsSchema: organizationIdParamsSchema,
  dataSchema: updateOrganizationBodySchema,
  requiredPermission: 'organizations.manage',
  handler: async ({ params, data, auth: { user: requester } }) => {
    resolveScope(requester, params.id);
    const update = data.name === undefined ? {} : { name: data.name };

    const organization = await organizationsService.update(params.id, update);

    return organization;
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

api.endpoint({
  method: 'delete',
  path: '/:id',
  summary: 'Delete an organization',
  tags: ['Organizations'],
  paramsSchema: organizationIdParamsSchema,
  middlewares: [isAdmin],
  statusCode: 204,
  handler: async ({ params }) => {
    await organizationsService.delete(params.id);
  },
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

export default api.router;
