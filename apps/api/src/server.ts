import { createApp } from './app.js';
import { loadEnvironment } from './config/env.js';

const environment = loadEnvironment();
const app = createApp();

const server = app.listen(environment.PORT, () => {
  console.info(`API listening on port ${environment.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}; closing API server.`);
  server.close((error) => {
    if (error) {
      console.error('Unable to close API server cleanly.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
