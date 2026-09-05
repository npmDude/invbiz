import type { Express } from 'express';

import authRouter from './modules/auth/auth.controller';
import organizationsRouter from './modules/organizations/organizations.controller';

export function setupRoutes(app: Express): void {
  app.use('/auth', authRouter);
  app.use('/organizations', organizationsRouter);
}
