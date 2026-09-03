import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { registry } from '../../openapi/registry';

extendZodWithOpenApi(z);

export const loginBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .openapi('LoginBody');

registry.register('LoginBody', loginBodySchema);

export type LoginBody = z.infer<typeof loginBodySchema>;
