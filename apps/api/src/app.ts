import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import createError from 'http-errors';
import { errorHandler } from './middlewares/error-handler';
import { openApiDocument } from './openapi';
import { setupRoutes } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(cookieParser());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Check API availability
   *     responses:
   *       '200':
   *         description: The API is available
   */
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  setupRoutes(app);

  app.use((_request, _response, next) => {
    next(createError(404, 'The requested resource was not found.'));
  });

  app.use(errorHandler);

  return app;
}
