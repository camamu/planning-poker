import { CardValue } from '../../domain/deck/CardValue.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { Clock } from '../../domain/shared/Clock.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface SetFinalEstimateCommand {
  readonly gameId: string;
  readonly participantId: string;
  readonly card: string;
}

export class SetFinalEstimate {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetFinalEstimateCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.setFinalEstimate(
      CardValue.of(command.card),
      ParticipantId.of(command.participantId),
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
