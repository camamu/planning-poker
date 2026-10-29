import { CardValue } from '../../domain/deck/CardValue.js';
import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface CastAsyncVoteCommand {
  readonly gameId: string;
  readonly participantId: string;
  readonly issueId: string;
  readonly card: string;
}

export class CastAsyncVote {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: CastAsyncVoteCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.castAsyncVote(
      ParticipantId.of(command.participantId),
      IssueId.of(command.issueId),
      CardValue.of(command.card),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
