import type { Game } from '../../domain/game/Game.js';
import type { GameId } from '../../domain/game/ids.js';

export interface GameRepository {
  findById(id: GameId): Promise<Game | undefined>;
  save(game: Game): Promise<void>;
}
