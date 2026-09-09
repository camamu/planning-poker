import type { GameId } from '../../domain/game/ids.js';

/** Un room de Socket.IO por partida (docs/01-especificacion.md §6.2). */
export function gameRoom(gameId: GameId): string {
  return `game:${gameId.value}`;
}
