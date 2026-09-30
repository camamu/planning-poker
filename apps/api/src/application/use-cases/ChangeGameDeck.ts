import type { Clock } from '../../domain/shared/Clock.js';
import { DeckId } from '../../domain/deck/DeckId.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { DeckNotFoundError } from './DeckNotFoundError.js';
import { loadGame } from './loadGame.js';

export interface ChangeGameDeckCommand {
  readonly gameId: string;
  readonly participantId: string;
  readonly deckId: string;
}

export class ChangeGameDeck {
  constructor(
    private readonly games: GameRepository,
    private readonly decks: DeckRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: ChangeGameDeckCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    const deckId = DeckId.of(command.deckId);
    const savedDeck = await this.decks.findById(deckId);
    if (!savedDeck) throw new DeckNotFoundError(deckId);
    savedDeck.assertAvailableTo(game.currentTeamId());

    game.changeDeck(
      savedDeck.currentDeck(),
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
