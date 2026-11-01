import type { RateLimitRule } from './RateLimiter.js';

export interface HttpRouteRateLimit {
  readonly method: string;
  /** El patrón de la ruta registrada (`/api/games/:id/participants`), no la URL concreta. */
  readonly url: string;
  readonly rule: RateLimitRule;
}

export interface HttpRateLimitPolicy {
  /** Tope común a toda `/api/*`, por IP. */
  readonly perIp: RateLimitRule;
  /** Topes más estrictos de operaciones raras o caras, también por IP. */
  readonly routes: ReadonlyArray<HttpRouteRateLimit>;
}

export interface SocketRateLimitPolicy {
  readonly connectionsPerIp: RateLimitRule;
  readonly eventsPerSocket: RateLimitRule;
  /** Topes por socket de eventos concretos, además del general. */
  readonly eventRules: Readonly<Record<string, RateLimitRule>>;
  /** Entre todos los sockets del mismo participante: abrir pestañas no multiplica el tope. */
  readonly votesPerParticipant: RateLimitRule;
}

export interface RateLimitPolicy {
  readonly http: HttpRateLimitPolicy;
  readonly socket: SocketRateLimitPolicy;
}

const perTenSeconds = (limit: number): RateLimitRule => ({ limit, windowMs: 10_000 });
const perMinute = (limit: number): RateLimitRule => ({ limit, windowMs: 60_000 });
const perHour = (limit: number): RateLimitRule => ({ limit, windowMs: 60 * 60_000 });

const OUTBOUND = perMinute(10);
const VOTES = perTenSeconds(20);
const BROADCASTS = perTenSeconds(20);

/**
 * Las cifras y su razonamiento están en el ADR 0031. Son generosas con un equipo entero detrás de
 * una IP: los topes por IP más estrictos son de operaciones que casi nadie repite.
 */
export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  http: {
    perIp: perMinute(600),
    routes: [
      { method: 'POST', url: '/api/games', rule: perHour(30) },
      { method: 'POST', url: '/api/teams', rule: perHour(10) },
      { method: 'POST', url: '/api/games/:id/participants', rule: perMinute(60) },
      { method: 'POST', url: '/api/games/:id/issues/batch', rule: perMinute(10) },
      { method: 'POST', url: '/api/games/:id/summary/webhook', rule: OUTBOUND },
      { method: 'POST', url: '/api/teams/:slug/webhooks/:webhookId/test', rule: OUTBOUND },
    ],
  },
  socket: {
    connectionsPerIp: perMinute(120),
    eventsPerSocket: perTenSeconds(100),
    eventRules: {
      vote: VOTES,
      async_vote: VOTES,
      join: perMinute(10),
      emoji_thrown: BROADCASTS,
      discussion_timer_control: BROADCASTS,
    },
    votesPerParticipant: perTenSeconds(40),
  },
};
