import { z } from 'zod';

import { defineSchema } from '../../shared/define-schema';

export const listInventoryQuerySchema = z.object({
  organizationId: z.uuid(),
  branchId: z.uuid().optional(),
  productId: z.uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

export const inventoryKeysParamsSchema = z.object({
  branchId: z.uuid(),
  productId: z.uuid(),
});

export type InventoryKeysParams = z.infer<typeof inventoryKeysParamsSchema>;

export const createInventoryBodySchema = defineSchema(
  'CreateInventoryBody',
  z.object({
    organizationId: z.uuid(),
    branchId: z.uuid(),
    productId: z.uuid(),
    salePrice: z.number().nonnegative().multipleOf(0.01),
    quantity: z.number().int().nonnegative().default(0),
  }),
);

export type CreateInventoryBody = z.infer<typeof createInventoryBodySchema>;

export const updateInventoryBodySchema = defineSchema(
  'UpdateInventoryBody',
  z.object({
    salePrice: z.number().nonnegative().multipleOf(0.01),
  }),
);

export type UpdateInventoryBody = z.infer<typeof updateInventoryBodySchema>;
