import type { Clock } from '../../domain/shared/Clock.js';
import { CardValue } from '../../domain/deck/CardValue.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
import { loadGame } from './loadGame.js';

export interface CastVoteCommand {
  readonly gameId: string;
  readonly participantId: string;
  readonly card: string;
}

export class CastVote {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(command: CastVoteCommand): Promise<void> {
    const gameId = GameId.of(command.gameId);
    const game = await loadGame(this.games, gameId);

    game.castVote(
      ParticipantId.of(command.participantId),
      CardValue.of(command.card),
      this.clock.now(),
      this.presence.votingPresence(gameId),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
