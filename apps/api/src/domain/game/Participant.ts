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
  ) {
    this.role = role;
  }

  static join(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    isFacilitator: boolean,
  ): Participant {
    return new Participant(id, displayName, role, isFacilitator);
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
