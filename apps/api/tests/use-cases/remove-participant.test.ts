import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { ParticipantHasLeftError } from '../../src/application/use-cases/ParticipantHasLeftError.js';
import { RemoveParticipant } from '../../src/application/use-cases/RemoveParticipant.js';
import { ParticipantRemovalNotAllowedError } from '../../src/domain/game/Game.js';
import { GameId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

async function joinVoter(seeded: SeededGame, displayName: string): Promise<string> {
  const joinGame = new JoinGame(
    seeded.context.games,
    seeded.context.events,
    seeded.context.clock,
    seeded.context.ids,
  );
  const id = await joinGame.execute({ gameId: seeded.gameId, displayName, role: 'VOTER' });
  seeded.context.events.clear();
  return id;
}

function removeUseCase(seeded: SeededGame): RemoveParticipant {
  return new RemoveParticipant(seeded.context.games, seeded.context.events, seeded.context.clock);
}

describe('RemoveParticipant', () => {
  it('da de baja al participante que sale y publica ParticipantLeft', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await removeUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: anaId,
      requestedBy: anaId,
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['ParticipantLeft']);
    const view = await new GetGameState(seeded.context.games).execute({
      gameId: seeded.gameId,
      viewerId: seeded.facilitatorId,
    });
    expect(view.participants.map((participant) => participant.id)).toEqual([seeded.facilitatorId]);
  });

  it('permite que el facilitador quite a otro participante', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await removeUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: anaId,
      requestedBy: seeded.facilitatorId,
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.allParticipants().filter((participant) => participant.hasLeft())).toHaveLength(
      1,
    );
  });

  it('rechaza que un participante quite a otro', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');
    const beaId = await joinVoter(seeded, 'Bea');

    await expect(
      removeUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: beaId,
        requestedBy: anaId,
      }),
    ).rejects.toThrow(ParticipantRemovalNotAllowedError);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();

    await expect(
      removeUseCase(seeded).execute({
        gameId: 'inexistente',
        participantId: seeded.facilitatorId,
        requestedBy: seeded.facilitatorId,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });

  it('impide pedir el estado de la partida a quien ya salió', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');
    await removeUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: anaId,
      requestedBy: anaId,
    });

    await expect(
      new GetGameState(seeded.context.games).execute({ gameId: seeded.gameId, viewerId: anaId }),
    ).rejects.toThrow(ParticipantHasLeftError);
  });
});
