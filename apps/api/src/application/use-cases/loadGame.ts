import type { Game } from '../../domain/game/Game.js';
import type { GameId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { GameNotFoundError } from './GameNotFoundError.js';

export async function loadGame(games: GameRepository, id: GameId): Promise<Game> {
  const game = await games.findById(id);
  if (!game) throw new GameNotFoundError(id);
  return game;
}
