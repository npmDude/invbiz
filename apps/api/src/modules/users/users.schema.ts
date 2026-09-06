import { z } from 'zod';

import { defineSchema } from '../../lib/define-schema';

export const listUsersQuerySchema = z.object({
  organizationId: z.uuid(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const createUserBodySchema = defineSchema(
  'CreateUserBody',
  z.object({
    organizationId: z.uuid(),
    name: z.string().trim().min(1).max(255),
    email: z.email().max(255),
    password: z.string().min(8).max(255),
    accessLevel: z.enum(['superuser', 'user']).optional(),
  }),
);

export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const updateUserBodySchema = defineSchema(
  'UpdateUserBody',
  z.object({
    organizationId: z.uuid().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    email: z.email().max(255).optional(),
    password: z.string().min(8).max(255).optional(),
    accessLevel: z.enum(['superuser', 'user']).optional(),
  }),
);

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
