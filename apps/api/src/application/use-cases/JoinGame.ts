import type { Clock } from '../../domain/shared/Clock.js';
import { DisplayName } from '../../domain/game/DisplayName.js';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { ParticipantRole } from '../../domain/game/Participant.js';
import type { EventPublisher } from '../ports/EventPublisher.js';
import type { GameRepository } from '../ports/GameRepository.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import { loadGame } from './loadGame.js';

export interface JoinGameCommand {
  readonly gameId: string;
  readonly displayName: string;
  readonly role: ParticipantRole;
}

export class JoinGame {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: JoinGameCommand): Promise<string> {
    const game = await loadGame(this.games, GameId.of(command.gameId));
    const participantId = ParticipantId.of(this.ids.generate());

    game.addParticipant(
      participantId,
      DisplayName.of(command.displayName),
      command.role,
      this.clock.now(),
    );

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
    return participantId.value;
  }
}
