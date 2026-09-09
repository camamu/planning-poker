import type { ServerEvent } from '@pp/contracts';
import type { GameId } from '../../domain/game/ids.js';

/**
 * Fan-out a todos los sockets de la room de una partida. Con una sola instancia el broadcast en
 * memoria basta (docs/02-decisiones-y-plan.md §1); si algún día hace falta más de una instancia,
 * la implementación cambia (Redis pub/sub) sin que `WsEventPublisher` se entere.
 */
export interface RealtimeBroadcaster {
  broadcastToGame(gameId: GameId, event: ServerEvent): Promise<void>;
}
