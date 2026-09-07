import createError from 'http-errors';
import { ApiRouter } from '../../shared/api-router';
import { resolveOrganizationScope } from '../../shared/organization-scope';
import { authService } from '../auth/auth.service';
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './users.schema';
import { usersService } from './users.service';

const api = new ApiRouter('/users');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List users',
  tags: ['Users'],
  querySchema: listUsersQuerySchema,
  requiredPermission: 'users.view',
  handler: async ({ query, auth: { user: requester } }) => {
    const organizationId = resolveOrganizationScope(
      requester,
      query.organizationId,
    );

    const users = await usersService.findAll({ organizationId });

    return users;
  },
  responses: {
    200: {
      description: 'Users retrieved',
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
  summary: 'Get a user',
  tags: ['Users'],
  paramsSchema: userIdParamsSchema,
  querySchema: listUsersQuerySchema,
  requiredPermission: 'users.view',
  handler: async ({ params, query, auth: { user: requester } }) => {
    const organizationId = resolveOrganizationScope(
      requester,
      query.organizationId,
    );
    const user = await usersService.findById(params.id, { organizationId });

    return user;
  },
  responses: {
    200: {
      description: 'User retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'User not found',
    },
  },
});

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Create a user',
  tags: ['Users'],
  dataSchema: createUserBodySchema,
  requiredPermission: 'users.create',
  statusCode: 201,
  handler: async ({ data, auth: { user: requester } }) => {
    const accessLevel = data.accessLevel ?? 'user';
    const organizationId =
      requester.accessLevel === 'admin'
        ? data.organizationId
        : resolveOrganizationScope(requester, data.organizationId);

    const password = await authService.hashPassword(data.password);

    const user = await usersService.create({
      organizationId,
      name: data.name,
      email: data.email,
      password,
      accessLevel,
    });

    return user;
  },
  responses: {
    201: {
      description: 'User created',
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
  summary: 'Update a user',
  tags: ['Users'],
  paramsSchema: userIdParamsSchema,
  querySchema: listUsersQuerySchema,
  dataSchema: updateUserBodySchema,
  requiredPermission: 'users.manage',
  handler: async ({ params, query, data, auth: { user: requester } }) => {
    const scopeOrganizationId = resolveOrganizationScope(
      requester,
      query.organizationId,
    );

    if (requester.accessLevel !== 'admin') {
      if (
        data.organizationId !== undefined &&
        data.organizationId !== scopeOrganizationId
      ) {
        throw createError(403, 'Insufficient permissions.', {
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
    }

    const { password, organizationId, ...rest } = data;

    const update: Partial<Parameters<typeof usersService.create>[0]> = {};

    if (rest.name !== undefined) {
      update.name = rest.name;
    }

    if (rest.email !== undefined) {
      update.email = rest.email;
    }

    if (rest.accessLevel !== undefined) {
      update.accessLevel = rest.accessLevel;
    }

    if (organizationId !== undefined && requester.accessLevel === 'admin') {
      update.organizationId = organizationId;
    }

    if (password !== undefined) {
      update.password = await authService.hashPassword(password);
    }

    const user = await usersService.update(params.id, update, {
      organizationId: scopeOrganizationId,
    });

    return user;
  },
  responses: {
    200: {
      description: 'User updated',
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
      description: 'User not found',
    },
  },
});

api.endpoint({
  method: 'delete',
  path: '/:id',
  summary: 'Delete a user',
  tags: ['Users'],
  paramsSchema: userIdParamsSchema,
  querySchema: listUsersQuerySchema,
  requiredPermission: 'users.manage',
  statusCode: 204,
  handler: async ({ params, query, auth: { user: requester } }) => {
    const organizationId = resolveOrganizationScope(
      requester,
      query.organizationId,
    );
    await usersService.delete(params.id, { organizationId });
  },
  responses: {
    204: {
      description: 'User deleted',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'User not found',
    },
  },
});

export default api.router;
