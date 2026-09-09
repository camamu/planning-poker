import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface AddIssueCommand {
  readonly gameId: string;
  readonly title: string;
}

export class AddIssue {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: AddIssueCommand): Promise<string> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const issueId = IssueId.of(this.ids.generate());

    game.addIssue(issueId, command.title, this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return issueId.value;
  }
}
