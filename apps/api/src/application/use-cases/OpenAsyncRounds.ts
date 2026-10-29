import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface OpenAsyncRoundsCommand {
  readonly gameId: string;
  readonly participantId: string;
  readonly issueIds: ReadonlyArray<string>;
}

export class OpenAsyncRounds {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: OpenAsyncRoundsCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const entries = command.issueIds.map((issueId) => ({
      roundId: RoundId.of(this.ids.generate()),
      issueId: IssueId.of(issueId),
    }));

    game.openAsyncRounds(entries, ParticipantId.of(command.participantId), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
