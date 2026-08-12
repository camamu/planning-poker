import type { Clock } from '../../domain/shared/Clock.js';
import { GameSettings } from '../../domain/game/GameSettings.js';
import type { WhoCanReveal } from '../../domain/game/GameSettings.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface UpdateGameSettingsCommand {
  readonly gameId: string;
  readonly participantId: string;
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
}

export class UpdateGameSettings {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateGameSettingsCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    const settings = GameSettings.of({
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
    });

    game.updateSettings(settings, ParticipantId.of(command.participantId), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
