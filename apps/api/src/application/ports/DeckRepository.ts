import type { SavedDeck } from '../../domain/deck/SavedDeck.js';
import type { DeckId } from '../../domain/deck/DeckId.js';
import type { TeamId } from '../../domain/team/TeamId.js';

export interface DeckRepository {
  findById(id: DeckId): Promise<SavedDeck | undefined>;
  /** Barajas de sistema + (si se pasa `teamId`) las personalizadas de ese equipo. */
  listAvailableFor(teamId: TeamId | null): Promise<ReadonlyArray<SavedDeck>>;
  save(deck: SavedDeck): Promise<void>;
  delete(id: DeckId): Promise<void>;
}
