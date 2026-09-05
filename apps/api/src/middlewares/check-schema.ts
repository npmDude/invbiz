import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

interface Input {
  querySchema?: z.ZodType;
  bodySchema?: z.ZodType;
}

export function checkSchema({ querySchema, bodySchema }: Input) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (querySchema) {
      const result = querySchema.safeParse(req.query);

      if (!result.success) {
        next(result.error);
        return;
      }
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);

      if (!result.success) {
        next(result.error);
        return;
      }
    }

    next();
  };
}
