import { ApiRouter } from '../../shared/api-router';
import { resolveScope } from '../../shared/scope';
import { inventoryService } from './inventory.service';
import {
  createInventoryBodySchema,
  inventoryKeysParamsSchema,
  listInventoryQuerySchema,
  updateInventoryBodySchema,
} from './inventory.schema';

const api = new ApiRouter('/inventory');

api.endpoint({
  method: 'get',
  path: '/',
  summary: 'List inventory',
  tags: ['Inventory'],
  querySchema: listInventoryQuerySchema,
  requiredPermission: 'inventory.view',
  handler: async ({ query, auth: { user: requester } }) => {
    const scope = resolveScope(requester, query.organizationId, {
      narrowBranches: true,
    });

    return inventoryService.findAll({
      organizationId: scope.organizationId,
      branchId: query.branchId,
      productId: query.productId,
      search: query.search,
      userId: scope.userId,
    });
  },
  responses: {
    200: {
      description: 'Inventory retrieved',
    },
    401: {
      description: 'Authentication is required',
    },
    403: {
      description: 'Insufficient permissions',
    },
    404: {
      description: 'Branch not found in this organization',
    },
  },
});

api.endpoint({
  method: 'post',
  path: '/',
  summary: 'Stock a product in a branch',
  tags: ['Inventory'],
  dataSchema: createInventoryBodySchema,
  requiredPermission: 'inventory.create',
  statusCode: 201,
  handler: async ({ data, auth: { user: requester } }) => {
    const scope = resolveScope(requester, data.organizationId, {
      narrowBranches: true,
    });

    return inventoryService.create({
      organizationId: scope.organizationId,
      branchId: data.branchId,
      productId: data.productId,
      salePrice: data.salePrice,
      quantity: data.quantity,
      userId: scope.userId,
    });
  },
  responses: {
    201: {
      description: 'Inventory created',
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
      description: 'Branch or product not found in this organization',
    },
    409: {
      description: 'Inventory already exists for this branch and product',
    },
  },
});

api.endpoint({
  method: 'patch',
  path: '/:branchId/:productId',
  summary: 'Update inventory sale price',
  tags: ['Inventory'],
  paramsSchema: inventoryKeysParamsSchema,
  querySchema: listInventoryQuerySchema.pick({ organizationId: true }),
  dataSchema: updateInventoryBodySchema,
  requiredPermission: 'inventory.manage',
  handler: async ({ params, query, data, auth: { user: requester } }) => {
    const scope = resolveScope(requester, query.organizationId, {
      narrowBranches: true,
    });

    return inventoryService.updateSalePrice(
      params.branchId,
      params.productId,
      data.salePrice,
      { organizationId: scope.organizationId, userId: scope.userId },
    );
  },
  responses: {
    200: {
      description: 'Inventory updated',
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
      description: 'Inventory not found',
    },
  },
});

export default api.router;
