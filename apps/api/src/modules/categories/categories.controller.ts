import { ApiRouter } from '../../shared/api-router';
import { resolveScope } from '../../shared/scope';
import { categoriesService } from './categories.service';
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from './categories.schema';

const api = new ApiRouter('/categories');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List categories',
  tags: ['Categories'],
  querySchema: listCategoriesQuerySchema,
  requiredPermission: 'categories.view',
  handler: async ({ query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    return categoriesService.findAll({ organizationId });
  },
  responses: {
    200: {
      description: 'Categories retrieved',
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
  summary: 'Get a category',
  tags: ['Categories'],
  paramsSchema: categoryIdParamsSchema,
  querySchema: listCategoriesQuerySchema,
  requiredPermission: 'categories.view',
  handler: async ({ params, query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    const category = await categoriesService.findById(params.id, {
      organizationId,
    });

    return category;
  },
  responses: {
    200: {
      description: 'Category retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Category not found',
    },
  },
});

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Create a category',
  tags: ['Categories'],
  dataSchema: createCategoryBodySchema,
  requiredPermission: 'categories.create',
  statusCode: 201,
  handler: async ({ data, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, data.organizationId);

    const category = await categoriesService.create({
      organizationId,
      name: data.name,
      parentId: data.parentId ?? null,
      order: data.order ?? 0,
    });

    return category;
  },
  responses: {
    201: {
      description: 'Category created',
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
    409: {
      description: 'Category name already exists',
    },
  },
});

api.endpoint({
  method: 'patch',
  path: '/:id',
  summary: 'Update a category',
  tags: ['Categories'],
  paramsSchema: categoryIdParamsSchema,
  querySchema: listCategoriesQuerySchema,
  dataSchema: updateCategoryBodySchema,
  requiredPermission: 'categories.manage',
  handler: async ({ params, query, data, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    const update: Partial<{
      name: string;
      parentId: string | null;
      order: number;
    }> = {};

    if (data.name !== undefined) {
      update.name = data.name;
    }

    if (data.parentId !== undefined) {
      update.parentId = data.parentId;
    }

    if (data.order !== undefined) {
      update.order = data.order;
    }

    const category = await categoriesService.update(params.id, update, {
      organizationId,
    });

    return category;
  },
  responses: {
    200: {
      description: 'Category updated',
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
      description: 'Category not found',
    },
    409: {
      description: 'Category name already exists',
    },
  },
});

api.endpoint({
  method: 'delete',
  path: '/:id',
  summary: 'Delete a category',
  tags: ['Categories'],
  paramsSchema: categoryIdParamsSchema,
  querySchema: listCategoriesQuerySchema,
  requiredPermission: 'categories.manage',
  statusCode: 204,
  handler: async ({ params, query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    await categoriesService.delete(params.id, { organizationId });
  },
  responses: {
    204: {
      description: 'Category deleted',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Category not found',
    },
  },
});

export default api.router;
