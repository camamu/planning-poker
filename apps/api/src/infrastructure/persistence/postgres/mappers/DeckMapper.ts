import type { Insertable, Selectable } from 'kysely';
import { CardValue } from '../../../../domain/deck/CardValue.js';
import { Deck } from '../../../../domain/deck/Deck.js';
import { DeckId } from '../../../../domain/deck/DeckId.js';
import { DeckName } from '../../../../domain/deck/DeckName.js';
import { SavedDeck } from '../../../../domain/deck/SavedDeck.js';
import { TeamId } from '../../../../domain/team/TeamId.js';
import type { DeckTable } from '../schema.js';

export function toDeckRow(deck: SavedDeck): Insertable<DeckTable> {
  return {
    id: deck.id.value,
    team_id: deck.teamId?.value ?? null,
    name: deck.name.value,
    cards: JSON.stringify(
      deck
        .currentDeck()
        .values()
        .map((card) => card.raw),
    ),
  };
}

export function toDomainDeck(row: Selectable<DeckTable>): SavedDeck {
  return SavedDeck.reconstitute({
    id: DeckId.of(row.id),
    teamId: row.team_id === null ? null : TeamId.of(row.team_id),
    name: DeckName.of(row.name),
    deck: Deck.of(row.cards.map((raw) => CardValue.of(raw))),
  });
}
