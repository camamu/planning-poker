import type { DeckRepository } from '../../../application/ports/DeckRepository.js';
import { SYSTEM_DECKS } from '../../../domain/deck/SavedDeck.js';
import type { SavedDeck } from '../../../domain/deck/SavedDeck.js';
import type { DeckId } from '../../../domain/deck/DeckId.js';
import type { TeamId } from '../../../domain/team/TeamId.js';

export class InMemoryDeckRepository implements DeckRepository {
  private readonly decks = new Map<string, SavedDeck>();

  constructor() {
    for (const deck of SYSTEM_DECKS) this.decks.set(deck.id.value, deck);
  }

  findById(id: DeckId): Promise<SavedDeck | undefined> {
    return Promise.resolve(this.decks.get(id.value));
  }

  listAvailableFor(teamId: TeamId | null): Promise<ReadonlyArray<SavedDeck>> {
    const decks = [...this.decks.values()].filter(
      (deck) => !deck.isCustom() || (teamId !== null && deck.belongsTo(teamId)),
    );
    return Promise.resolve(decks);
  }

  listCustom(): Promise<ReadonlyArray<SavedDeck>> {
    return Promise.resolve([...this.decks.values()].filter((deck) => deck.isCustom()));
  }

  save(deck: SavedDeck): Promise<void> {
    this.decks.set(deck.id.value, deck);
    return Promise.resolve();
  }

  delete(id: DeckId): Promise<void> {
    this.decks.delete(id.value);
    return Promise.resolve();
  }

  deleteOwnedBy(teamId: TeamId): Promise<void> {
    for (const deck of this.decks.values()) {
      if (deck.belongsTo(teamId)) this.decks.delete(deck.id.value);
    }
    return Promise.resolve();
  }
}
