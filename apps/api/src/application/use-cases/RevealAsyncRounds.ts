import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, IssueId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface RevealAsyncRoundsCommand {
  readonly gameId: string;
  readonly participantId: string;
  /** Ausente = todas las rondas en diferido abiertas que tengan votos. */
  readonly issueIds?: ReadonlyArray<string> | undefined;
}

export class RevealAsyncRounds {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevealAsyncRoundsCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.revealAsyncRounds(
      command.issueIds ? command.issueIds.map((issueId) => IssueId.of(issueId)) : 'ALL',
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
