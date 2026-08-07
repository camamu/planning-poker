import type { Game } from '../../../domain/game/Game.js';
import type { GameId } from '../../../domain/game/ids.js';
import type { GameRepository } from '../../../application/ports/GameRepository.js';

export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();

  findById(id: GameId): Promise<Game | undefined> {
    return Promise.resolve(this.games.get(id.value));
  }

  save(game: Game): Promise<void> {
    this.games.set(game.id.value, game);
    return Promise.resolve();
  }
}
