import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface ImportIssueEntry {
  readonly title: string;
  readonly description?: string;
  readonly externalUrl?: string;
}

export interface ImportIssuesCommand {
  readonly gameId: string;
  readonly issues: ReadonlyArray<ImportIssueEntry>;
}

export class ImportIssues {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: ImportIssuesCommand): Promise<ReadonlyArray<string>> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const drafts = command.issues.map((entry) => ({
      id: IssueId.of(this.ids.generate()),
      title: entry.title,
      description: entry.description,
      externalUrl: entry.externalUrl,
    }));

    game.importIssues(drafts, this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return drafts.map((draft) => draft.id.value);
  }
}
