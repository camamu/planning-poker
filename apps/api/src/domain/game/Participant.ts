import type { DisplayName } from './DisplayName.js';
import type { ParticipantId } from './ids.js';

export type ParticipantRole = 'VOTER' | 'SPECTATOR';

export class Participant {
  private role: ParticipantRole;

  private constructor(
    readonly id: ParticipantId,
    readonly displayName: DisplayName,
    role: ParticipantRole,
    readonly isFacilitator: boolean,
    /** Orden de entrada a la partida, estable entre reconstituciones. Base de `Game.currentDealer()`. */
    readonly joinOrder: number,
  ) {
    this.role = role;
  }

  static join(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    isFacilitator: boolean,
    joinOrder: number,
  ): Participant {
    return new Participant(id, displayName, role, isFacilitator, joinOrder);
  }

  changeRole(role: ParticipantRole): void {
    this.role = role;
  }

  currentRole(): ParticipantRole {
    return this.role;
  }

  isSpectator(): boolean {
    return this.role === 'SPECTATOR';
  }
}
