import { z } from 'zod';

import { defineSchema } from '../../shared/define-schema';

export const organizationIdParamsSchema = z.object({
  id: z.uuid(),
});

export type OrganizationIdParams = z.infer<typeof organizationIdParamsSchema>;

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
