import type { Clock } from '../../domain/shared/Clock.js';
import { GameId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
import { loadGame } from './loadGame.js';

export interface ReconcileAutoRevealCommand {
  readonly gameId: string;
}

/** Se invoca cuando alguien se desconecta: puede que fuera el último que faltaba por votar. */
export class ReconcileAutoReveal {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(command: ReconcileAutoRevealCommand): Promise<void> {
    const gameId = GameId.of(command.gameId);
    const game = await loadGame(this.games, gameId);

    game.reconcileAutoReveal(this.clock.now(), this.presence.votingPresence(gameId));

    const domainEvents = game.pullDomainEvents();
    if (domainEvents.length === 0) return;
    await this.games.save(game);
    await this.events.publishAll(domainEvents);
  }
}
