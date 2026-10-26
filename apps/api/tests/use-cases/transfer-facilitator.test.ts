import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { TransferFacilitator } from '../../src/application/use-cases/TransferFacilitator.js';
import { FacilitatorTransferNotAllowedError } from '../../src/domain/game/Game.js';
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

function transferUseCase(seeded: SeededGame): TransferFacilitator {
  return new TransferFacilitator(seeded.context.games, seeded.context.events, seeded.context.clock);
}

describe('TransferFacilitator', () => {
  it('pasa el rol al elegido, publica FacilitatorChanged y la vista lo expone', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await transferUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      toParticipantId: anaId,
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'FacilitatorChanged',
    ]);
    const view = await new GetGameState(seeded.context.games).execute({
      gameId: seeded.gameId,
      viewerId: anaId,
    });
    expect(
      view.participants
        .filter((participant) => participant.isFacilitator)
        .map((participant) => participant.id),
    ).toEqual([anaId]);
  });

  it('rechaza que lo ceda quien no es facilitador sin publicar nada', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');
    const beaId = await joinVoter(seeded, 'Bea');

    await expect(
      transferUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: anaId,
        toParticipantId: beaId,
      }),
    ).rejects.toThrow(FacilitatorTransferNotAllowedError);
    expect(seeded.context.events.published).toEqual([]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();

    await expect(
      transferUseCase(seeded).execute({
        gameId: 'inexistente',
        participantId: seeded.facilitatorId,
        toParticipantId: seeded.facilitatorId,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
