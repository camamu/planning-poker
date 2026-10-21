import type { Clock } from '../../domain/shared/Clock.js';
import { Hat } from '../../domain/game/Hat.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface ChangeParticipantHatCommand {
  readonly gameId: string;
  readonly participantId: string;
  /** `null` = quitarse el sombrero. */
  readonly hat: string | null;
  readonly requestedBy: string;
}

export class ChangeParticipantHat {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: ChangeParticipantHatCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.changeParticipantHat(
      ParticipantId.of(command.participantId),
      command.hat === null ? null : Hat.of(command.hat),
      ParticipantId.of(command.requestedBy),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
