import { z } from 'zod';

import { defineSchema } from '../../lib/define-schema';

export const listBranchesQuerySchema = z.object({
  organizationId: z.uuid().optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;

export const branchIdParamsSchema = z.object({
  id: z.uuid(),
});

export type BranchIdParams = z.infer<typeof branchIdParamsSchema>;

export const createBranchBodySchema = defineSchema(
  'CreateBranchBody',
  z.object({
    organizationId: z.uuid().optional(),
    name: z.string().trim().min(1).max(255),
    address: z.string().trim().min(1).max(255),
  }),
);

export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;

export const updateBranchBodySchema = defineSchema(
  'UpdateBranchBody',
  z.object({
    name: z.string().trim().min(1).max(255).optional(),
    address: z.string().trim().min(1).max(255).optional(),
  }),
);

export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>;
