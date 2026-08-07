import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, RoundId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface StartVotingRoundCommand {
  readonly gameId: string;
  readonly issueId: string;
}

export class StartVotingRound {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: StartVotingRoundCommand): Promise<string> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const roundId = RoundId.of(this.ids.generate());

    game.startVotingRound(roundId, IssueId.of(command.issueId), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return roundId.value;
  }
}
