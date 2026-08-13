import { DeckId } from '../../domain/deck/DeckId.js';
import { DeckName } from '../../domain/deck/DeckName.js';
import { SavedDeck } from '../../domain/deck/SavedDeck.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';
import { DeckNotFoundError } from './DeckNotFoundError.js';

export interface UpdateCustomDeckCommand {
  readonly teamSlug: string;
  readonly token: string;
  readonly deckId: string;
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
}

export class UpdateCustomDeck {
  constructor(
    private readonly decks: DeckRepository,
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
  ) {}

  async execute(command: UpdateCustomDeckCommand): Promise<void> {
    const team = await resolveTeam(this.teams, this.hasher, command.teamSlug, command.token);

    const id = DeckId.of(command.deckId);
    const existing = await this.decks.findById(id);
    if (!existing) throw new DeckNotFoundError(id);
    existing.assertOwnedBy(team.id);

    const updated = SavedDeck.createCustom({
      id,
      teamId: team.id,
      name: DeckName.of(command.name),
      rawCards: command.cards,
    });
    await this.decks.save(updated);
  }
}
