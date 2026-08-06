import Fastify from 'fastify';
import { Pool } from 'pg';
import { loadEnv } from './infrastructure/config/env.js';
import { registerHealthRoutes } from './infrastructure/http/routes/health.js';

const env = loadEnv();

const app = Fastify({ logger: { level: env.LOG_LEVEL } });
const db = new Pool({ connectionString: env.DATABASE_URL });

db.on('error', (error) => {
  app.log.error(error, 'error inesperado en un cliente idle del pool de postgres');
});

registerHealthRoutes(app, db);

app.addHook('onClose', async () => {
  await db.end();
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });
