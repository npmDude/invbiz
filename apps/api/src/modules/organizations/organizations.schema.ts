import { z } from 'zod';

import { defineSchema } from '../../lib/define-schema';

export const createOrganizationBodySchema = defineSchema(
  'CreateOrganizationBody',
  z.object({
    name: z.string().trim().min(1).max(255),
  }),
);

export type CreateOrganizationBody = z.infer<
  typeof createOrganizationBodySchema
>;

export const updateOrganizationBodySchema = defineSchema(
  'UpdateOrganizationBody',
  z.object({
    name: z.string().trim().min(1).max(255).optional(),
  }),
);

export type UpdateOrganizationBody = z.infer<
  typeof updateOrganizationBodySchema
>;
