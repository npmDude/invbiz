import createError from 'http-errors';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Derive a response code from an `http-errors` constructor name,
 * e.g. `NotFoundError` -> `NOT_FOUND_ERROR`.
 */
function toErrorCode(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  void next;

  if (createError.isHttpError(error)) {
    const { code } = error as { code?: unknown };

    response.status(error.status).json({
      error: {
        code: typeof code === 'string' ? code : toErrorCode(error.name),
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid data.',
        details: error.issues,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};
