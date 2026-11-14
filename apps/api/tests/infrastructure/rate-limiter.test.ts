import { describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT_POLICY } from '../../src/infrastructure/security/rateLimitPolicy.js';
import { RateLimiter } from '../../src/infrastructure/security/RateLimiter.js';
import { SocketRateLimits } from '../../src/infrastructure/realtime/SocketRateLimits.js';

const WINDOW_MS = 10_000;
const NOW = 1_000_000;

describe('RateLimiter', () => {
  it('permite hasta el límite dentro de la ventana y rechaza la siguiente petición', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: WINDOW_MS });

    expect(limiter.consume('ip', NOW).allowed).toBe(true);
    expect(limiter.consume('ip', NOW + 1).allowed).toBe(true);
    expect(limiter.consume('ip', NOW + 2).allowed).toBe(true);
    expect(limiter.consume('ip', NOW + 3).allowed).toBe(false);
  });

  it('dice cuánto falta para que se libere la ventana', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: WINDOW_MS });
    limiter.consume('ip', NOW);

    expect(limiter.consume('ip', NOW + 2_500)).toEqual({ allowed: false, retryAfterMs: 7_500 });
  });

  it('vuelve a permitir cuando vence la ventana', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: WINDOW_MS });
    limiter.consume('ip', NOW);

    expect(limiter.consume('ip', NOW + WINDOW_MS - 1).allowed).toBe(false);
    expect(limiter.consume('ip', NOW + WINDOW_MS).allowed).toBe(true);
  });

  it('cuenta cada clave por separado', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: WINDOW_MS });

    expect(limiter.consume('a', NOW).allowed).toBe(true);
    expect(limiter.consume('b', NOW).allowed).toBe(true);
    expect(limiter.consume('a', NOW).allowed).toBe(false);
  });

  it('no alarga el bloqueo por seguir insistiendo', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: WINDOW_MS });
    limiter.consume('ip', NOW);
    for (let offset = 1; offset < 100; offset += 1) limiter.consume('ip', NOW + offset * 50);

    expect(limiter.consume('ip', NOW + WINDOW_MS).allowed).toBe(true);
  });

  it('olvida las ventanas vencidas para no acumular memoria', () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: WINDOW_MS });
    for (let index = 0; index < 50; index += 1) limiter.consume(`ip-${index.toString()}`, NOW);
    expect(limiter.trackedKeys).toBe(50);

    limiter.consume('otra', NOW + WINDOW_MS);

    expect(limiter.trackedKeys).toBe(1);
  });

  it('acota la memoria si alguien rota las claves, olvidando primero las más antiguas', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: WINDOW_MS }, 3);
    for (let index = 0; index < 5; index += 1)
      limiter.consume(`ip-${index.toString()}`, NOW + index);

    expect(limiter.trackedKeys).toBe(3);
    expect(limiter.consume('ip-4', NOW + 10).allowed).toBe(false);
    expect(limiter.consume('ip-0', NOW + 10).allowed).toBe(true);
  });
});

describe('SocketRateLimits', () => {
  const rule = (limit: number): { limit: number; windowMs: number } => ({
    limit,
    windowMs: WINDOW_MS,
  });
  const build = (): SocketRateLimits =>
    new SocketRateLimits({
      connectionsPerIp: rule(1),
      eventsPerSocket: rule(4),
      eventRules: { vote: rule(2) },
      votesPerParticipant: rule(3),
    });

  it('aplica el tope propio de un evento y deja pasar los demás', () => {
    const limits = build();

    expect(limits.allowEvent('s1', 'vote', NOW).allowed).toBe(true);
    expect(limits.allowEvent('s1', 'vote', NOW).allowed).toBe(true);
    expect(limits.allowEvent('s1', 'vote', NOW).allowed).toBe(false);
    expect(limits.allowEvent('s1', 'reveal', NOW).allowed).toBe(true);
  });

  it('aplica el tope general del socket a cualquier evento', () => {
    const limits = build();
    for (const event of ['reveal', 'reveal', 'reveal', 'reveal'])
      expect(limits.allowEvent('s1', event, NOW).allowed).toBe(true);

    expect(limits.allowEvent('s1', 'reveal', NOW).allowed).toBe(false);
    expect(limits.allowEvent('s2', 'reveal', NOW).allowed).toBe(true);
  });

  it('suma los votos de un mismo participante aunque vengan de sockets distintos', () => {
    const limits = build();

    for (let vote = 0; vote < 3; vote += 1)
      expect(limits.allowVote('g1', 'p1', NOW).allowed).toBe(true);
    expect(limits.allowVote('g1', 'p1', NOW).allowed).toBe(false);
    expect(limits.allowVote('g1', 'p2', NOW).allowed).toBe(true);
    expect(limits.allowVote('g2', 'p1', NOW).allowed).toBe(true);
  });

  it('limita las conexiones nuevas por IP', () => {
    const limits = build();

    expect(limits.allowConnection('1.2.3.4', NOW).allowed).toBe(true);
    expect(limits.allowConnection('1.2.3.4', NOW).allowed).toBe(false);
    expect(limits.allowConnection('5.6.7.8', NOW).allowed).toBe(true);
  });
});

describe('política de límites por defecto', () => {
  it('deja a un equipo entero detrás de una IP unirse y conectarse sin rozar el tope', () => {
    const { http, socket } = DEFAULT_RATE_LIMIT_POLICY;
    const joins = http.routes.find((route) => route.url === '/api/games/:id/participants');

    expect(joins?.rule.limit).toBeGreaterThanOrEqual(30);
    expect(socket.connectionsPerIp.limit).toBeGreaterThanOrEqual(60);
  });
});
