import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import { AppError } from './lib/app-error';
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
    next(
      new AppError('The requested resource was not found.', 404, 'NOT_FOUND'),
    );
  });

  app.use(errorHandler);

  return app;
}
