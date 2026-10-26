import type { DisplayName } from './DisplayName.js';
import type { Hat } from './Hat.js';
import type { ParticipantId } from './ids.js';

export type ParticipantRole = 'VOTER' | 'SPECTATOR';

export class Participant {
  private role: ParticipantRole;
  private facilitator: boolean;
  private left: boolean;
  private hat: Hat | null;

  private constructor(
    readonly id: ParticipantId,
    readonly displayName: DisplayName,
    role: ParticipantRole,
    facilitator: boolean,
    /** Orden de entrada a la partida, estable entre reconstituciones. Base de `Game.currentDealer()`. */
    readonly joinOrder: number,
    left: boolean,
    hat: Hat | null,
  ) {
    this.role = role;
    this.facilitator = facilitator;
    this.left = left;
    this.hat = hat;
  }

  static join(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    isFacilitator: boolean,
    joinOrder: number,
    left = false,
    hat: Hat | null = null,
  ): Participant {
    return new Participant(id, displayName, role, isFacilitator, joinOrder, left, hat);
  }

  get isFacilitator(): boolean {
    return this.facilitator;
  }

  /** Solo `Game` los llama, de dos en dos, para que siga habiendo exactamente un facilitador. */
  promote(): void {
    this.facilitator = true;
  }

  demote(): void {
    this.facilitator = false;
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

  /** `null` = sin sombrero. */
  wearHat(hat: Hat | null): void {
    this.hat = hat;
  }

  currentHat(): Hat | null {
    return this.hat;
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
