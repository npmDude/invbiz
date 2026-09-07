import { z } from 'zod';

import { defineSchema } from '../../shared/define-schema';

export const listProductsQuerySchema = z.object({
  organizationId: z.uuid(),
  categoryId: z.uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productIdParamsSchema = z.object({
  id: z.uuid(),
});

export type ProductIdParams = z.infer<typeof productIdParamsSchema>;

const productName = z.string().trim().min(1).max(255);
const productCode = z.string().trim().min(1).max(64);
const supplierPrice = z.number().nonnegative().multipleOf(0.01);
const productDescription = z.string().trim().min(1).nullish();
const stockAlert = z.number().int().min(0).nullish();
const categoryIds = z.array(z.uuid()).min(1).max(50);

export const createProductBodySchema = defineSchema(
  'CreateProductBody',
  z.object({
    organizationId: z.uuid(),
    name: productName,
    code: productCode,
    supplierPrice,
    description: productDescription,
    stockAlert,
    categoryIds,
  }),
);

export type CreateProductBody = z.infer<typeof createProductBodySchema>;

export const updateProductBodySchema = defineSchema(
  'UpdateProductBody',
  z.object({
    name: productName.optional(),
    code: productCode.optional(),
    supplierPrice: supplierPrice.optional(),
    description: productDescription,
    stockAlert,
    categoryIds: categoryIds.optional(),
  }),
);

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
