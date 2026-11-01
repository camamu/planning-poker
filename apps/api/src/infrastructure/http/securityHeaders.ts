import type { FastifyInstance } from 'fastify';

export interface ApiSecurityHeadersOptions {
  /** Solo detrás de HTTPS: en local (http) el navegador lo ignora, pero no tiene sentido enviarlo. */
  readonly hsts: boolean;
}

/** 180 días. Sin `includeSubDomains`: esta cabecera la envía la API y no decide por el resto. */
const HSTS = 'max-age=15552000';

/**
 * La API solo devuelve JSON, así que la CSP no permite cargar nada (ADR 0031). `no-store` porque
 * la respuesta de una partida cambia según quién pregunta (invariante 7: los votos ajenos están
 * ocultos hasta el revelado) y un intermediario no debe reutilizarla entre espectadores.
 */
export function registerApiSecurityHeaders(
  app: FastifyInstance,
  options: ApiSecurityHeadersOptions,
): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    reply.header('referrer-policy', 'no-referrer');
    if (options.hsts) reply.header('strict-transport-security', HSTS);
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    return payload;
  });
}
