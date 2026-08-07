import type { GameId } from '../../domain/game/ids.js';

export class GameNotFoundError extends Error {
  constructor(readonly gameId: GameId) {
    super(`No existe la partida ${gameId.value}.`);
    this.name = 'GameNotFoundError';
  }
}
