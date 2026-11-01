import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, RoundId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
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
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(command: StartVotingRoundCommand): Promise<string> {
    const gameId = GameId.of(command.gameId);
    const game = await loadGame(this.games, gameId);
    const roundId = RoundId.of(this.ids.generate());

    game.startVotingRound(
      roundId,
      IssueId.of(command.issueId),
      this.clock.now(),
      this.presence.votingPresence(gameId),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return roundId.value;
  }
}
