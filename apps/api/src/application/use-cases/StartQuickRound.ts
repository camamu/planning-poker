import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, RoundId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface StartQuickRoundCommand {
  readonly gameId: string;
}

export interface StartQuickRoundResult {
  readonly issueId: string;
  readonly roundId: string;
}

export class StartQuickRound {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: StartQuickRoundCommand): Promise<StartQuickRoundResult> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const issueId = IssueId.of(this.ids.generate());
    const roundId = RoundId.of(this.ids.generate());

    game.startQuickRound(issueId, roundId, this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return { issueId: issueId.value, roundId: roundId.value };
  }
}
