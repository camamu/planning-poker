import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { UpdateGameSettings } from '../../src/application/use-cases/UpdateGameSettings.js';
import { SettingsChangeNotAllowedError } from '../../src/domain/game/Game.js';
import { GameId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

describe('UpdateGameSettings', () => {
  it('el facilitador puede cambiar los ajustes de la partida', async () => {
    const seeded = await seedGame();
    const useCase = new UpdateGameSettings(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      settings: { autoReveal: true, whoCanReveal: 'ANYONE', countdownSeconds: 90 },
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentSettings().autoReveal).toBe(true);
    expect(stored?.currentSettings().countdownSeconds).toBe(90);
  });

  it('publica GameSettingsChanged', async () => {
    const seeded = await seedGame();
    const useCase = new UpdateGameSettings(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      settings: { autoReveal: true, whoCanReveal: 'ANYONE' },
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'GameSettingsChanged',
    ]);
  });

  it('lanza SettingsChangeNotAllowedError si quien pide el cambio no es el facilitador', async () => {
    const seeded = await seedGame();
    const joinGame = new JoinGame(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    const voterId = await joinGame.execute({
      gameId: seeded.gameId,
      displayName: 'Grace',
      role: 'VOTER',
    });

    const useCase = new UpdateGameSettings(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({
        gameId: seeded.gameId,
        participantId: voterId,
        settings: { autoReveal: true, whoCanReveal: 'ANYONE' },
      }),
    ).rejects.toThrow(SettingsChangeNotAllowedError);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const useCase = new UpdateGameSettings(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({
        gameId: 'inexistente',
        participantId: seeded.facilitatorId,
        settings: { autoReveal: true, whoCanReveal: 'ANYONE' },
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
