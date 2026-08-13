import type { DeckId } from '../../domain/deck/DeckId.js';

export class DeckNotFoundError extends Error {
  constructor(readonly deckId: DeckId) {
    super(`No existe la baraja ${deckId.value}.`);
    this.name = 'DeckNotFoundError';
  }
}
