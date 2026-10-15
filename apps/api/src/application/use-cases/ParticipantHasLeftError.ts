import type { GameId, ParticipantId } from '../../domain/game/ids.js';

export class ParticipantHasLeftError extends Error {
  constructor(
    readonly gameId: GameId,
    readonly participantId: ParticipantId,
  ) {
    super(`El participante ${participantId.value} ya no está en la partida ${gameId.value}.`);
    this.name = 'ParticipantHasLeftError';
  }
}
