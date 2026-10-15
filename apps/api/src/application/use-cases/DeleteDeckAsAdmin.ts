import { DeckId } from '../../domain/deck/DeckId.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import { DeckNotFoundError } from './DeckNotFoundError.js';

export interface DeleteDeckAsAdminCommand {
  readonly deckId: string;
}

/** A diferencia de `DeleteCustomDeck`, no exige token de equipo: el panel puede borrar la de cualquiera. */
export class DeleteDeckAsAdmin {
  constructor(private readonly decks: DeckRepository) {}

  async execute(command: DeleteDeckAsAdminCommand): Promise<void> {
    const id = DeckId.of(command.deckId);
    const deck = await this.decks.findById(id);
    if (!deck) throw new DeckNotFoundError(id);
    deck.assertDeletable();
    await this.decks.delete(id);
  }
}
