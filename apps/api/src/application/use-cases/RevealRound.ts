import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

export interface RevealRoundCommand {
  readonly gameId: string;
  readonly participantId: string;
}

export class RevealRound {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevealRoundCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.reveal(ParticipantId.of(command.participantId), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
