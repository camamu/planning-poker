import type { GameView } from '@pp/contracts';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { toGameView } from '../read-models/toGameView.js';
import { loadGame } from './loadGame.js';

export interface GetGameStateQuery {
  readonly gameId: string;
  readonly viewerId: string;
}

export class GetGameState {
  constructor(private readonly games: GameRepository) {}

  async execute(query: GetGameStateQuery): Promise<GameView> {
    const game = await loadGame(this.games, GameId.of(query.gameId));
    return toGameView(game, ParticipantId.of(query.viewerId));
  }
}
