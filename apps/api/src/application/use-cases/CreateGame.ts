import type { Clock } from '../../domain/shared/Clock.js';
import { Deck } from '../../domain/deck/Deck.js';
import { DisplayName } from '../../domain/game/DisplayName.js';
import { Game } from '../../domain/game/Game.js';
import { GameName } from '../../domain/game/GameName.js';
import { GameSettings } from '../../domain/game/GameSettings.js';
import type { WhoCanReveal } from '../../domain/game/GameSettings.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';

export type DeckPreset = 'fibonacci' | 'tshirt';

export interface CreateGameCommand {
  readonly name: string;
  readonly deckPreset: DeckPreset;
  readonly settings: {
    readonly autoReveal: boolean;
    readonly whoCanReveal: WhoCanReveal;
    readonly namedRevealers?: ReadonlyArray<string>;
  };
  readonly facilitatorName: string;
}

export interface CreateGameResult {
  readonly gameId: string;
  readonly facilitatorId: string;
}

function deckFromPreset(preset: DeckPreset): Deck {
  switch (preset) {
    case 'fibonacci':
      return Deck.fibonacci();
    case 'tshirt':
      return Deck.tshirt();
  }
}

export class CreateGame {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateGameCommand): Promise<CreateGameResult> {
    const facilitatorId = ParticipantId.of(this.ids.generate());
    const game = Game.create(
      {
        id: GameId.of(this.ids.generate()),
        name: GameName.of(command.name),
        deck: deckFromPreset(command.deckPreset),
        settings: GameSettings.of({
          autoReveal: command.settings.autoReveal,
          whoCanReveal: command.settings.whoCanReveal,
          ...(command.settings.namedRevealers
            ? { namedRevealers: command.settings.namedRevealers.map((id) => ParticipantId.of(id)) }
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
