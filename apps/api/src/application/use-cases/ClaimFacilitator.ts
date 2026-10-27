import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
import { loadGame } from './loadGame.js';

export interface ClaimFacilitatorCommand {
  readonly gameId: string;
  /** Quien toma el relevo. */
  readonly participantId: string;
}

export class ClaimFacilitator {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(command: ClaimFacilitatorCommand): Promise<void> {
    const gameId = GameId.of(command.gameId);
    const game = await loadGame(this.games, gameId);

    game.claimFacilitator(
      ParticipantId.of(command.participantId),
      this.clock.now(),
      this.presence.votingPresence(gameId),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
