import { buildApp } from './app.js';
import { config, validateProductionConfig } from './config.js';

const app = buildApp();

try {
  validateProductionConfig();
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
