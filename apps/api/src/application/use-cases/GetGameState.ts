import type { GameView } from '@pp/contracts';
import { GameId, ParticipantId } from '../../domain/game/ids.js';
import type { GameRepository } from '../ports/GameRepository.js';
import { UNKNOWN_PRESENCE } from '../ports/PresenceReader.js';
import type { PresenceReader } from '../ports/PresenceReader.js';
import { toGameView } from '../read-models/toGameView.js';
import { ParticipantHasLeftError } from './ParticipantHasLeftError.js';
import { loadGame } from './loadGame.js';

export interface GetGameStateQuery {
  readonly gameId: string;
  readonly viewerId: string;
}

export class GetGameState {
  constructor(
    private readonly games: GameRepository,
    private readonly presence: PresenceReader = UNKNOWN_PRESENCE,
  ) {}

  async execute(query: GetGameStateQuery): Promise<GameView> {
    const gameId = GameId.of(query.gameId);
    const viewerId = ParticipantId.of(query.viewerId);
    const game = await loadGame(this.games, gameId);
    if (game.hasParticipantLeft(viewerId)) throw new ParticipantHasLeftError(gameId, viewerId);
    return toGameView(game, viewerId, this.presence.onlineParticipants(gameId));
  }
}
