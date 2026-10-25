import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface RemoveIssueCommand {
  readonly gameId: string;
  readonly issueId: string;
  readonly participantId: string;
}

export class RemoveIssue {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: RemoveIssueCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.removeIssue(
      IssueId.of(command.issueId),
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
