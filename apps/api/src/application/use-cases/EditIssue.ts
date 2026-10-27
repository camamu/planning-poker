import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface EditIssueCommand {
  readonly gameId: string;
  readonly issueId: string;
  readonly participantId: string;
  readonly title: string;
  readonly description?: string;
  readonly externalUrl?: string;
}

export class EditIssue {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: EditIssueCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.editIssue(
      IssueId.of(command.issueId),
      {
        title: command.title,
        description: command.description,
        externalUrl: command.externalUrl,
      },
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
