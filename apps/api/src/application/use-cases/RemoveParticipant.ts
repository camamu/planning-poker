import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
import { loadGame } from './loadGame.js';

export interface RemoveParticipantCommand {
  readonly gameId: string;
  /** Quien sale o a quien se quita. */
  readonly participantId: string;
  /** Quien lo pide: el propio participante o el facilitador. */
  readonly requestedBy: string;
}

export class RemoveParticipant {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(command: RemoveParticipantCommand): Promise<void> {
    const gameId = GameId.of(command.gameId);
    const game = await loadGame(this.games, gameId);

    game.removeParticipant(
      ParticipantId.of(command.participantId),
      ParticipantId.of(command.requestedBy),
      this.clock.now(),
      this.presence.votingPresence(gameId),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
