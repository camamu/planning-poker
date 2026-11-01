import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Clock } from '../../domain/shared/Clock.js';
import type { HttpRateLimitPolicy } from '../security/rateLimitPolicy.js';
import { RATE_LIMIT_MESSAGE, RateLimiter } from '../security/RateLimiter.js';
import type { RateLimitVerdict } from '../security/RateLimiter.js';

/**
 * Limita por IP toda `/api/*` y, además, las rutas de la política (ADR 0031). Hay que registrarlo
 * DESPUÉS de `@fastify/cors`: los hooks corren en orden de registro, y un 429 sin
 * `Access-Control-Allow-Origin` llega al navegador como un error de red sin mensaje. Los
 * preflight `OPTIONS` los contesta CORS antes de llegar aquí, y `/health` y `/ready` no cuelgan de
 * `/api/` para que ni el despertar de la API ni el latido de Render gasten cupo.
 */
export function registerHttpRateLimit(
  app: FastifyInstance,
  policy: HttpRateLimitPolicy,
  clock: Clock,
): void {
  const everything = new RateLimiter(policy.perIp);
  const perRoute = policy.routes.map((route) => ({
    ...route,
    limiter: new RateLimiter(route.rule),
  }));

  const check = (request: FastifyRequest, now: number): RateLimitVerdict => {
    const overall = everything.consume(request.ip, now);
    if (!overall.allowed) return overall;

    const route = perRoute.find(
      (candidate) =>
        candidate.method === request.method && candidate.url === request.routeOptions.url,
    );
    return route?.limiter.consume(request.ip, now) ?? overall;
  };

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || !request.url.startsWith('/api/')) return undefined;

    const verdict = check(request, clock.now().getTime());
    if (verdict.allowed) return undefined;

    request.log.warn({ ip: request.ip, url: request.url }, 'petición rechazada por límite de uso');
    return reply
      .code(429)
      .header('retry-after', Math.ceil(verdict.retryAfterMs / 1000).toString())
      .send({ error: 'TooManyRequests', message: RATE_LIMIT_MESSAGE });
  });
}
