import type { DeckSummaryView } from '@pp/contracts';
import type { SavedDeck } from '../../domain/deck/SavedDeck.js';

export function toDeckSummaryView(deck: SavedDeck): DeckSummaryView {
  return {
    id: deck.id.value,
    name: deck.name.value,
    cards: deck
      .currentDeck()
      .values()
      .map((card) => card.raw),
    teamId: deck.teamId?.value ?? null,
  };
}
