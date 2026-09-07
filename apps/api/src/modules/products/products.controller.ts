import { ApiRouter } from '../../shared/api-router';
import { resolveScope } from '../../shared/scope';
import { productsService } from './products.service';
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductBodySchema,
} from './products.schema';

const api = new ApiRouter('/products');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List products',
  tags: ['Products'],
  querySchema: listProductsQuerySchema,
  requiredPermission: 'products.view',
  handler: async ({ query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    return productsService.findAll({
      organizationId,
      categoryId: query.categoryId,
      search: query.search,
    });
  },
  responses: {
    200: {
      description: 'Products retrieved',
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
  summary: 'Get a product',
  tags: ['Products'],
  paramsSchema: productIdParamsSchema,
  querySchema: listProductsQuerySchema.pick({ organizationId: true }),
  requiredPermission: 'products.view',
  handler: async ({ params, query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    return productsService.findById(params.id, { organizationId });
  },
  responses: {
    200: {
      description: 'Product retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Product not found',
    },
  },
});

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Create a product',
  tags: ['Products'],
  dataSchema: createProductBodySchema,
  requiredPermission: 'products.create',
  statusCode: 201,
  handler: async ({ data, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, data.organizationId);

    return productsService.create({
      organizationId,
      name: data.name,
      code: data.code,
      supplierPrice: data.supplierPrice,
      description: data.description ?? null,
      stockAlert: data.stockAlert ?? null,
      categoryIds: data.categoryIds,
    });
  },
  responses: {
    201: {
      description: 'Product created',
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
      description: 'Product name or code already exists',
    },
  },
});

api.endpoint({
  method: 'patch',
  path: '/:id',
  summary: 'Update a product',
  tags: ['Products'],
  paramsSchema: productIdParamsSchema,
  querySchema: listProductsQuerySchema.pick({ organizationId: true }),
  dataSchema: updateProductBodySchema,
  requiredPermission: 'products.manage',
  handler: async ({ params, query, data, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    return productsService.update(
      params.id,
      {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.supplierPrice !== undefined
          ? { supplierPrice: data.supplierPrice }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.stockAlert !== undefined
          ? { stockAlert: data.stockAlert }
          : {}),
        ...(data.categoryIds !== undefined
          ? { categoryIds: data.categoryIds }
          : {}),
      },
      { organizationId },
    );
  },
  responses: {
    200: {
      description: 'Product updated',
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
      description: 'Product not found',
    },
    409: {
      description: 'Product name or code already exists',
    },
  },
});

api.endpoint({
  method: 'delete',
  path: '/:id',
  summary: 'Delete a product',
  tags: ['Products'],
  paramsSchema: productIdParamsSchema,
  querySchema: listProductsQuerySchema.pick({ organizationId: true }),
  requiredPermission: 'products.manage',
  statusCode: 204,
  handler: async ({ params, query, auth: { user: requester } }) => {
    const { organizationId } = resolveScope(requester, query.organizationId);

    await productsService.delete(params.id, { organizationId });
  },
  responses: {
    204: {
      description: 'Product deleted',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Product not found',
    },
  },
});

export default api.router;
