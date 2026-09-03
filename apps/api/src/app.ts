import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import { AppError } from './lib/app-error';
import { errorHandler } from './middlewares/error-handler';
import { openApiDocument } from './openapi';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  /**
   * @openapi
   * /api/health:
   *   get:
   *     summary: Check API availability
   *     responses:
   *       '200':
   *         description: The API is available
   */
  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use((_request, _response, next) => {
    next(
      new AppError('The requested resource was not found.', 404, 'NOT_FOUND'),
    );
  });

  app.use(errorHandler);

  return app;
}
