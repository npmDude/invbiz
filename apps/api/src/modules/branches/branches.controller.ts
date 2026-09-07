import { ApiRouter } from '../../shared/api-router';
import { resolveScope } from '../../shared/scope';
import { branchesService } from './branches.service';
import {
  branchIdParamsSchema,
  createBranchBodySchema,
  listBranchesQuerySchema,
  updateBranchBodySchema,
} from './branches.schema';

const api = new ApiRouter('/branches');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List branches',
  tags: ['Branches'],
  querySchema: listBranchesQuerySchema,
  requiredPermission: 'branches.view',
  handler: async ({ query, auth: { user: requester } }) => {
    return branchesService.findAll(
      resolveScope(requester, query.organizationId, { narrowBranches: true }),
    );
  },
  responses: {
    200: {
      description: 'Branches retrieved',
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
  summary: 'Get a branch',
  tags: ['Branches'],
  paramsSchema: branchIdParamsSchema,
  querySchema: listBranchesQuerySchema,
  requiredPermission: 'branches.view',
  handler: async ({ params, query, auth: { user: requester } }) => {
    const branch = await branchesService.findById(
      params.id,
      resolveScope(requester, query.organizationId, { narrowBranches: true }),
    );

    return branch;
  },
  responses: {
    200: {
      description: 'Branch retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Branch not found',
    },
  },
});

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Create a branch',
  tags: ['Branches'],
  dataSchema: createBranchBodySchema,
  requiredPermission: 'branches.create',
  statusCode: 201,
  handler: async ({ data, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, data.organizationId);

    const branch = await branchesService.create({
      organizationId,
      name: data.name,
      address: data.address,
    });

    return branch;
  },
  responses: {
    201: {
      description: 'Branch created',
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
  summary: 'Update a branch',
  tags: ['Branches'],
  paramsSchema: branchIdParamsSchema,
  querySchema: listBranchesQuerySchema,
  dataSchema: updateBranchBodySchema,
  requiredPermission: 'branches.manage',
  handler: async ({ params, query, data, auth: { user: requester } }) => {
    const update: Partial<{ name: string; address: string }> = {};

    if (data.name !== undefined) {
      update.name = data.name;
    }

    if (data.address !== undefined) {
      update.address = data.address;
    }

    const branch = await branchesService.update(
      params.id,
      update,
      resolveScope(requester, query.organizationId, { narrowBranches: true }),
    );

    return branch;
  },
  responses: {
    200: {
      description: 'Branch updated',
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
      description: 'Branch not found',
    },
  },
});

api.endpoint({
  method: 'delete',
  path: '/:id',
  summary: 'Delete a branch',
  tags: ['Branches'],
  paramsSchema: branchIdParamsSchema,
  querySchema: listBranchesQuerySchema,
  requiredPermission: 'branches.manage',
  statusCode: 204,
  handler: async ({ params, query, auth: { user: requester } }) => {
    await branchesService.delete(
      params.id,
      resolveScope(requester, query.organizationId, { narrowBranches: true }),
    );
  },
  responses: {
    204: {
      description: 'Branch deleted',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Branch not found',
    },
  },
});

export default api.router;
