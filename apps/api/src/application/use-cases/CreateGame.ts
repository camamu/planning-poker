import type { Clock } from '../../domain/shared/Clock.js';
import { DeckId } from '../../domain/deck/DeckId.js';
import { DisplayName } from '../../domain/game/DisplayName.js';
import { Game } from '../../domain/game/Game.js';
import { GameName } from '../../domain/game/GameName.js';
import { GameSettings } from '../../domain/game/GameSettings.js';
import type { WhoCanReveal } from '../../domain/game/GameSettings.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { DeckRepository } from '../ports/DeckRepository.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { DeckNotFoundError } from './DeckNotFoundError.js';

export interface CreateGameCommand {
  readonly name: string;
  readonly deckId: string;
  readonly settings: {
    readonly autoReveal: boolean;
    readonly whoCanReveal: WhoCanReveal;
    readonly namedRevealers?: ReadonlyArray<string>;
    readonly allowVoteChange?: boolean;
    readonly celebrate?: boolean;
    readonly throwEmojis?: boolean;
    readonly countdownSeconds?: number | null;
    readonly revealOnTimeout?: boolean;
  };
  readonly facilitatorName: string;
}

export interface CreateGameResult {
  readonly gameId: string;
  readonly facilitatorId: string;
}

export class CreateGame {
  constructor(
    private readonly games: GameRepository,
    private readonly decks: DeckRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateGameCommand): Promise<CreateGameResult> {
    const deckId = DeckId.of(command.deckId);
    const savedDeck = await this.decks.findById(deckId);
    if (!savedDeck) throw new DeckNotFoundError(deckId);

    const facilitatorId = ParticipantId.of(this.ids.generate());
    const game = Game.create(
      {
        id: GameId.of(this.ids.generate()),
        name: GameName.of(command.name),
        deck: savedDeck.currentDeck(),
        settings: GameSettings.of({
          autoReveal: command.settings.autoReveal,
          whoCanReveal: command.settings.whoCanReveal,
          ...(command.settings.namedRevealers
            ? { namedRevealers: command.settings.namedRevealers.map((id) => ParticipantId.of(id)) }
            : {}),
          ...(command.settings.allowVoteChange !== undefined
            ? { allowVoteChange: command.settings.allowVoteChange }
            : {}),
          ...(command.settings.celebrate !== undefined
            ? { celebrate: command.settings.celebrate }
            : {}),
          ...(command.settings.throwEmojis !== undefined
            ? { throwEmojis: command.settings.throwEmojis }
            : {}),
          ...(command.settings.countdownSeconds !== undefined
            ? { countdownSeconds: command.settings.countdownSeconds }
            : {}),
          ...(command.settings.revealOnTimeout !== undefined
            ? { revealOnTimeout: command.settings.revealOnTimeout }
            : {}),
        }),
        facilitatorId,
        facilitatorName: DisplayName.of(command.facilitatorName),
      },
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return { gameId: game.id.value, facilitatorId: facilitatorId.value };
  }
}
