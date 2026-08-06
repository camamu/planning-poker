import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export function registerHealthRoutes(app: FastifyInstance, db: Pool): void {
  app.get('/health', () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
