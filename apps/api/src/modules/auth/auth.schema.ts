import { z } from 'zod';

import { defineSchema } from '../../lib/define-schema';

export const loginBodySchema = defineSchema(
  'LoginBody',
  z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
);

export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = defineSchema(
  'RefreshBody',
  z.object({
    // Optional: browser clients send the refresh token as an HttpOnly
    // cookie instead; mobile and other API clients send it here.
    refreshToken: z.string().min(1).optional(),
  }),
);

export type RefreshBody = z.infer<typeof refreshBodySchema>;
