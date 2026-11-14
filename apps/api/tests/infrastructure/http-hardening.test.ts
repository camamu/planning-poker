import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Clock } from '../../src/domain/shared/Clock.js';
import { registerHttpRateLimit } from '../../src/infrastructure/http/rateLimit.js';
import { registerApiSecurityHeaders } from '../../src/infrastructure/http/securityHeaders.js';
import { fastifyTrustProxy } from '../../src/infrastructure/security/clientIp.js';
import type { HttpRateLimitPolicy } from '../../src/infrastructure/security/rateLimitPolicy.js';
import { RATE_LIMIT_MESSAGE } from '../../src/infrastructure/security/RateLimiter.js';

const ORIGIN = 'https://pp.test';
const MINUTE = { windowMs: 60_000 };

const policy: HttpRateLimitPolicy = {
  perIp: { limit: 5, ...MINUTE },
  routes: [{ method: 'POST', url: '/api/games', rule: { limit: 2, ...MINUTE } }],
};

const clock: Clock = { now: () => new Date(1_000_000) };

describe('límites de uso y cabeceras en la API', () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  async function buildApp(
    options: { trustedHops?: number; hsts?: boolean } = {},
  ): Promise<FastifyInstance> {
    const app = Fastify({ trustProxy: fastifyTrustProxy(options.trustedHops ?? 0) });
    apps.push(app);
    await app.register(cors, { origin: ORIGIN });
    registerHttpRateLimit(app, policy, clock);
    registerApiSecurityHeaders(app, { hsts: options.hsts ?? false });
    app.post('/api/games', () => ({ ok: true }));
    app.get('/api/things', () => ({ ok: true }));
    app.get('/health', () => ({ status: 'ok' }));
    app.get('/api/cacheable', (_request, reply) => {
      void reply.header('cache-control', 'max-age=60').send({ ok: true });
    });
    await app.ready();
    return app;
  }

  it('responde 429 con Retry-After y el mensaje de siempre cuando se agota el tope de la IP', async () => {
    const app = await buildApp();
    for (let request = 0; request < 5; request += 1) await app.inject({ url: '/api/things' });

    const blocked = await app.inject({ url: '/api/things' });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBe('60');
    expect(blocked.json()).toEqual({ error: 'TooManyRequests', message: RATE_LIMIT_MESSAGE });
  });

  it('el 429 lleva las cabeceras de CORS: sin ellas el navegador no podría leer el mensaje', async () => {
    const app = await buildApp();
    for (let request = 0; request < 5; request += 1) await app.inject({ url: '/api/things' });

    const blocked = await app.inject({ url: '/api/things', headers: { origin: ORIGIN } });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('aplica el tope propio de una ruta antes que el general', async () => {
    const app = await buildApp();

    expect((await app.inject({ method: 'POST', url: '/api/games' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/games' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/games' })).statusCode).toBe(429);
    expect((await app.inject({ url: '/api/things' })).statusCode).toBe(200);
  });

  it('no cuenta /health ni los preflight de CORS contra el tope', async () => {
    const app = await buildApp();
    for (let request = 0; request < 20; request += 1) {
      await app.inject({ url: '/health' });
      await app.inject({
        method: 'OPTIONS',
        url: '/api/things',
        headers: { origin: ORIGIN, 'access-control-request-method': 'GET' },
      });
    }

    expect((await app.inject({ url: '/api/things' })).statusCode).toBe(200);
  });

  it('cuenta aparte a cada cliente detrás del proxy de confianza', async () => {
    const app = await buildApp({ trustedHops: 1 });
    const statusFrom = async (client: string): Promise<number> =>
      (await app.inject({ url: '/api/things', headers: { 'x-forwarded-for': client } })).statusCode;
    for (let request = 0; request < 5; request += 1) await statusFrom('203.0.113.1');

    expect(await statusFrom('203.0.113.1')).toBe(429);
    expect(await statusFrom('203.0.113.2')).toBe(200);
  });

  it('no deja esquivar el tope falsificando las entradas de X-Forwarded-For que escribe el cliente', async () => {
    const app = await buildApp({ trustedHops: 1 });
    for (let request = 0; request < 5; request += 1)
      await app.inject({
        url: '/api/things',
        headers: { 'x-forwarded-for': `10.9.9.${request.toString()}, 203.0.113.1` },
      });

    const spoofed = await app.inject({
      url: '/api/things',
      headers: { 'x-forwarded-for': '10.1.1.1, 203.0.113.1' },
    });

    expect(spoofed.statusCode).toBe(429);
  });

  it('envía las cabeceras de seguridad también en un 429', async () => {
    const app = await buildApp();
    for (let request = 0; request < 5; request += 1) await app.inject({ url: '/api/things' });

    const blocked = await app.inject({ url: '/api/things' });

    expect(blocked.headers['x-content-type-options']).toBe('nosniff');
    expect(blocked.headers['referrer-policy']).toBe('no-referrer');
    expect(blocked.headers['cache-control']).toBe('no-store');
  });

  it('la API no permite cargar nada ni incrustarse: CSP de solo JSON', async () => {
    const app = await buildApp();

    const response = await app.inject({ url: '/api/things' });

    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('envía Strict-Transport-Security solo cuando se pide, es decir, en producción', async () => {
    const plain = await buildApp();
    const secure = await buildApp({ hsts: true });

    expect((await plain.inject({ url: '/health' })).headers['strict-transport-security']).toBe(
      undefined,
    );
    expect((await secure.inject({ url: '/health' })).headers['strict-transport-security']).toBe(
      'max-age=15552000',
    );
  });

  it('no pisa un Cache-Control que la ruta ya fijó', async () => {
    const app = await buildApp();

    const response = await app.inject({ url: '/api/cacheable' });

    expect(response.headers['cache-control']).toBe('max-age=60');
  });
});
