import type { Clock } from '../../domain/shared/Clock.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { loadGame } from './loadGame.js';

/**
 * F5 — cuenta atrás: el cliente dispara este comando al agotarse su cuenta atrás local, y
 * `Game.revealOnTimeout` valida contra la fecha límite guardada en el servidor antes de revelar
 * (docs/adr/0005-extension-de-alcance-bloque-6.md). Mismo shape que `RevealRoundCommand` — es el
 * mismo par (gameId, participantId), solo cambia qué método del agregado invoca.
 */
export interface TimeoutRevealCommand {
  readonly gameId: string;
  readonly participantId: string;
}

export class TimeoutReveal {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: TimeoutRevealCommand): Promise<void> {
    const game = await loadGame(this.games, GameId.of(command.gameId));

    game.revealOnTimeout(ParticipantId.of(command.participantId), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
