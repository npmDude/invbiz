import type { Express } from 'express';

import authRouter from './modules/auth/auth.controller';

export function setupRoutes(app: Express): void {
  app.use('/auth', authRouter);
}
