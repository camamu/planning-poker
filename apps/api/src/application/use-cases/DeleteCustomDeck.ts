import { DeckId } from '../../domain/deck/DeckId.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';
import { DeckNotFoundError } from './DeckNotFoundError.js';

export interface DeleteCustomDeckCommand {
  readonly teamSlug: string;
  readonly token: string;
  readonly deckId: string;
}

export class DeleteCustomDeck {
  constructor(
    private readonly decks: DeckRepository,
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
  ) {}

  async execute(command: DeleteCustomDeckCommand): Promise<void> {
    const team = await resolveTeam(this.teams, this.hasher, command.teamSlug, command.token);

    const id = DeckId.of(command.deckId);
    const existing = await this.decks.findById(id);
    if (!existing) throw new DeckNotFoundError(id);
    existing.assertOwnedBy(team.id);

    await this.decks.delete(id);
  }
}
