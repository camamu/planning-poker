import type { Server } from 'socket.io';
import type { ReconcileAutoReveal } from '../../application/use-cases/ReconcileAutoReveal.js';
import { gameRoom } from './gameRoom.js';
import { GameId } from '../../domain/game/ids.js';
import type { PresenceListener } from './PresenceTracker.js';

/**
 * Reparte el cambio de presencia a la sala (evento efímero, sin versión) y, si alguien se ha
 * desconectado, deja que el dominio compruebe si era el último que faltaba por votar.
 */
export function createPresenceListener(
  io: Server,
  reconcileAutoReveal: ReconcileAutoReveal,
  onError: (error: unknown) => void,
): PresenceListener {
  return (change) => {
    io.to(gameRoom(GameId.of(change.gameId))).emit('presence_changed', {
      type: 'presence_changed',
      participantId: change.participantId,
      online: change.online,
    });
    if (change.online) return;
    reconcileAutoReveal.execute({ gameId: change.gameId }).catch(onError);
  };
}
