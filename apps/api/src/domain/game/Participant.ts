import type { DisplayName } from './DisplayName.js';
import type { ParticipantId } from './ids.js';

export type ParticipantRole = 'VOTER' | 'SPECTATOR';

export class Participant {
  private role: ParticipantRole;
  private left: boolean;

  private constructor(
    readonly id: ParticipantId,
    readonly displayName: DisplayName,
    role: ParticipantRole,
    readonly isFacilitator: boolean,
    /** Orden de entrada a la partida, estable entre reconstituciones. Base de `Game.currentDealer()`. */
    readonly joinOrder: number,
    left: boolean,
  ) {
    this.role = role;
    this.left = left;
  }

  static join(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    isFacilitator: boolean,
    joinOrder: number,
    left = false,
  ): Participant {
    return new Participant(id, displayName, role, isFacilitator, joinOrder, left);
  }

  /**
   * Baja lógica, no borrado: los votos de rondas ya reveladas apuntan a este participante y el
   * resultado de esas rondas es histórico (ver ADR 0015).
   */
  leave(): void {
    this.left = true;
  }

  hasLeft(): boolean {
    return this.left;
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
