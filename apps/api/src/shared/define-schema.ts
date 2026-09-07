import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { registry } from '../openapi/registry';

extendZodWithOpenApi(z);

// Defines a named request/response body schema and registers it for OpenAPI
// in one step, so modules don't repeat the openapi/register boilerplate.
export function defineSchema<TSchema extends z.ZodTypeAny>(
  name: string,
  schema: TSchema,
): TSchema {
  const annotated = schema.openapi(name);
  registry.register(name, annotated);
  return annotated;
}
