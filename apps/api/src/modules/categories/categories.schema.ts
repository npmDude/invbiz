import { z } from 'zod';

import { defineSchema } from '../../lib/define-schema';

export const listCategoriesQuerySchema = z.object({
  organizationId: z.uuid(),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

export const categoryIdParamsSchema = z.object({
  id: z.uuid(),
});

export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;

export const createCategoryBodySchema = defineSchema(
  'CreateCategoryBody',
  z.object({
    organizationId: z.uuid(),
    name: z.string().trim().min(1).max(255),
    parentId: z.uuid().nullish(),
    order: z.number().int().min(0).optional(),
  }),
);

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;

export const updateCategoryBodySchema = defineSchema(
  'UpdateCategoryBody',
  z.object({
    name: z.string().trim().min(1).max(255).optional(),
    parentId: z.uuid().nullish(),
    order: z.number().int().min(0).optional(),
  }),
);

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
