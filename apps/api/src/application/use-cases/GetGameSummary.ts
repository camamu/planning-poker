import type { GameSummaryView } from '@pp/contracts';
import { GameId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { toGameSummaryView } from '../read-models/toGameSummaryView.js';
import { loadGame } from './loadGame.js';

/** Cualquiera con el enlace de la partida puede ver su resumen, igual que la propia partida (ADR 0025). */
export class GetGameSummary {
  constructor(private readonly games: GameRepository) {}

  async execute(query: { readonly gameId: string }): Promise<GameSummaryView> {
    const game = await loadGame(this.games, GameId.of(query.gameId));
    return toGameSummaryView(game);
  }
}
