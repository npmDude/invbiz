import type { Express } from 'express';

import authRouter from './modules/auth/auth.controller';
import organizationsRouter from './modules/organizations/organizations.controller';
import usersRouter from './modules/users/users.controller';

export function setupRoutes(app: Express): void {
  app.use('/auth', authRouter);
  app.use('/organizations', organizationsRouter);
  app.use('/users', usersRouter);
}
