import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface TransferFacilitatorCommand {
  readonly gameId: string;
  /** Quien cede el rol: tiene que ser el facilitador actual. */
  readonly participantId: string;
  readonly toParticipantId: string;
}

export class TransferFacilitator {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: TransferFacilitatorCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.transferFacilitator(
      ParticipantId.of(command.toParticipantId),
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
