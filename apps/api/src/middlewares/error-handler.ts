import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../lib/app-error.js';

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  void next;

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
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
