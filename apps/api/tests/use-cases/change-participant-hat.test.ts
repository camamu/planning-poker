import { describe, expect, it } from 'vitest';
import { ChangeParticipantHat } from '../../src/application/use-cases/ChangeParticipantHat.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { HatChangeNotAllowedError } from '../../src/domain/game/Game.js';
import { UnknownHatError } from '../../src/domain/game/Hat.js';
import { seedGame } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

function changeHatUseCase(seeded: SeededGame): ChangeParticipantHat {
  return new ChangeParticipantHat(
    seeded.context.games,
    seeded.context.events,
    seeded.context.clock,
  );
}

describe('ChangeParticipantHat', () => {
  it('guarda el sombrero, publica ParticipantHatChanged y la vista lo expone', async () => {
    const seeded = await seedGame();

    await changeHatUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      hat: 'wizard',
      requestedBy: seeded.facilitatorId,
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'ParticipantHatChanged',
    ]);
    const view = await new GetGameState(seeded.context.games).execute({
      gameId: seeded.gameId,
      viewerId: seeded.facilitatorId,
    });
    expect(view.participants[0]?.hat).toBe('wizard');
  });

  it('rechaza un sombrero desconocido sin publicar nada', async () => {
    const seeded = await seedGame();

    await expect(
      changeHatUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        hat: 'casco-de-moto',
        requestedBy: seeded.facilitatorId,
      }),
    ).rejects.toThrow(UnknownHatError);
    expect(seeded.context.events.published).toEqual([]);
  });

  it('rechaza cambiar el sombrero de otro participante', async () => {
    const seeded = await seedGame();

    await expect(
      changeHatUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        hat: 'crown',
        requestedBy: 'otro-participante',
      }),
    ).rejects.toThrow(HatChangeNotAllowedError);
  });
});
