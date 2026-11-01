import type { SocketRateLimitPolicy } from '../security/rateLimitPolicy.js';
import { RateLimiter } from '../security/RateLimiter.js';
import type { RateLimitVerdict } from '../security/RateLimiter.js';

/**
 * Los contadores de Socket.IO de la política (ADR 0031): conexiones por IP, eventos por socket
 * (uno general y otro por tipo de evento) y votos por participante. Las claves de socket son el
 * `socket.id`: cada reconexión es un socket nuevo, por eso hay un tope de conexiones por IP.
 */
export class SocketRateLimits {
  private readonly connections: RateLimiter;
  private readonly events: RateLimiter;
  private readonly perEvent: ReadonlyMap<string, RateLimiter>;
  private readonly votes: RateLimiter;

  constructor(policy: SocketRateLimitPolicy) {
    this.connections = new RateLimiter(policy.connectionsPerIp);
    this.events = new RateLimiter(policy.eventsPerSocket);
    this.perEvent = new Map(
      Object.entries(policy.eventRules).map(([event, rule]) => [event, new RateLimiter(rule)]),
    );
    this.votes = new RateLimiter(policy.votesPerParticipant);
  }

  allowConnection(ip: string, now: number): RateLimitVerdict {
    return this.connections.consume(ip, now);
  }

  allowEvent(socketId: string, event: string, now: number): RateLimitVerdict {
    const overall = this.events.consume(socketId, now);
    if (!overall.allowed) return overall;
    return this.perEvent.get(event)?.consume(socketId, now) ?? overall;
  }

  allowVote(gameId: string, participantId: string, now: number): RateLimitVerdict {
    return this.votes.consume(`${gameId}:${participantId}`, now);
  }
}
