import { DeckId } from '../../domain/deck/DeckId.js';
import { DeckName } from '../../domain/deck/DeckName.js';
import { SavedDeck } from '../../domain/deck/SavedDeck.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';

export interface SaveCustomDeckCommand {
  readonly teamSlug: string;
  readonly token: string;
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
}

export interface SaveCustomDeckResult {
  readonly deckId: string;
}

export class SaveCustomDeck {
  constructor(
    private readonly decks: DeckRepository,
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: SaveCustomDeckCommand): Promise<SaveCustomDeckResult> {
    const team = await resolveTeam(this.teams, this.hasher, command.teamSlug, command.token);

    const deck = SavedDeck.createCustom({
      id: DeckId.of(this.ids.generate()),
      teamId: team.id,
      name: DeckName.of(command.name),
      rawCards: command.cards,
    });

    await this.decks.save(deck);
    return { deckId: deck.id.value };
  }
}
