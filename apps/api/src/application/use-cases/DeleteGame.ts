import { GameId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { RealtimeBroadcaster } from '../ports/RealtimeBroadcaster.js';
import { loadGame } from './loadGame.js';

export interface DeleteGameCommand {
  readonly gameId: string;
}

export class DeleteGame {
  constructor(
    private readonly games: GameRepository,
    private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  async execute(command: DeleteGameCommand): Promise<void> {
    const id = GameId.of(command.gameId);
    await loadGame(this.games, id);
    await this.games.delete(id);
    await this.broadcaster.closeGame(id);
  }
}
