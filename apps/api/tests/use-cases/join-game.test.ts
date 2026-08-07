import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

describe('JoinGame', () => {
  it('añade al participante a la partida existente', async () => {
    const seeded = await seedGame();
    const useCase = new JoinGame(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    const participantId = await useCase.execute({
      gameId: seeded.gameId,
      displayName: 'Grace',
      role: 'VOTER',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.canReveal(ParticipantId.of(participantId))).toBe(false);
  });

  it('permite unirse como espectador', async () => {
    const seeded = await seedGame();
    const useCase = new JoinGame(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    const participantId = await useCase.execute({
      gameId: seeded.gameId,
      displayName: 'Espectador',
      role: 'SPECTATOR',
    });

    expect(participantId).toBeTruthy();
    expect(
      seeded.context.events.published.some((event) => event.type === 'ParticipantJoined'),
    ).toBe(true);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const useCase = new JoinGame(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await expect(
      useCase.execute({ gameId: 'inexistente', displayName: 'Grace', role: 'VOTER' }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
