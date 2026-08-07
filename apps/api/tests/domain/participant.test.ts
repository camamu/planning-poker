import { describe, expect, it } from 'vitest';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import { ParticipantId } from '../../src/domain/game/ids.js';
import { Participant } from '../../src/domain/game/Participant.js';

describe('Participant', () => {
  it('se une con el rol indicado', () => {
    const participant = Participant.join(
      ParticipantId.of('p1'),
      DisplayName.of('Ada'),
      'VOTER',
      false,
    );
    expect(participant.currentRole()).toBe('VOTER');
    expect(participant.isSpectator()).toBe(false);
    expect(participant.isFacilitator).toBe(false);
  });

  it('changeRole() cambia el rol actual', () => {
    const participant = Participant.join(
      ParticipantId.of('p1'),
      DisplayName.of('Ada'),
      'VOTER',
      false,
    );
    participant.changeRole('SPECTATOR');
    expect(participant.currentRole()).toBe('SPECTATOR');
    expect(participant.isSpectator()).toBe(true);
  });
});
