import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

interface Input {
  querySchema?: z.ZodType;
  bodySchema?: z.ZodType;
}

export function checkSchema({ querySchema, bodySchema }: Input) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (querySchema) {
      const result = querySchema.safeParse(req.query);

      if (!result.success) {
        return res.status(400).json(result.error);
      }
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json(result.error);
      }
    }

    next();
  };
}
