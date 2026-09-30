import type { DeckSummaryView } from '@pp/contracts';
import { GameId } from '../../domain/game/ids.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { toDeckSummaryView } from '../read-models/toDeckSummaryView.js';
import { loadGame } from './loadGame.js';

export interface ListGameDecksQuery {
  readonly gameId: string;
}

/** Las barajas entre las que se puede cambiar dentro de una partida: sistema + las de su equipo. */
export class ListGameDecks {
  constructor(
    private readonly games: GameRepository,
    private readonly decks: DeckRepository,
  ) {}

  async execute(query: ListGameDecksQuery): Promise<ReadonlyArray<DeckSummaryView>> {
    const game = await loadGame(this.games, GameId.of(query.gameId));
    const decks = await this.decks.listAvailableFor(game.currentTeamId());
    return decks.map(toDeckSummaryView);
  }
}
