import { describe, expect, it } from 'vitest';
import type { PresenceReader } from '../../src/application/ports/PresenceReader.js';
import { ClaimFacilitator } from '../../src/application/use-cases/ClaimFacilitator.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import {
  FacilitatorPresenceUnknownError,
  FacilitatorStillPresentError,
} from '../../src/domain/game/Game.js';
import { ParticipantId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

function presenceOf(ids: ReadonlyArray<string> | undefined): PresenceReader {
  const participants = ids?.map((id) => ParticipantId.of(id));
  return { onlineParticipants: () => participants ?? [], votingPresence: () => participants };
}

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

function claimUseCase(seeded: SeededGame, presence?: PresenceReader): ClaimFacilitator {
  return new ClaimFacilitator(
    seeded.context.games,
    seeded.context.events,
    seeded.context.clock,
    presence,
  );
}

describe('ClaimFacilitator', () => {
  it('traspasa el rol a quien lo pide si el facilitador no está conectado y publica FacilitatorChanged', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await claimUseCase(seeded, presenceOf([anaId])).execute({
      gameId: seeded.gameId,
      participantId: anaId,
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'FacilitatorChanged',
    ]);
    const view = await new GetGameState(seeded.context.games).execute({
      gameId: seeded.gameId,
      viewerId: anaId,
    });
    expect(view.participants.find((participant) => participant.id === anaId)?.isFacilitator).toBe(
      true,
    );
  });

  it('rechaza el relevo si el facilitador sigue conectado sin publicar nada', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await expect(
      claimUseCase(seeded, presenceOf([seeded.facilitatorId, anaId])).execute({
        gameId: seeded.gameId,
        participantId: anaId,
      }),
    ).rejects.toThrow(FacilitatorStillPresentError);
    expect(seeded.context.events.published).toEqual([]);
  });

  it('rechaza el relevo mientras la presencia no se conoce', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await expect(
      claimUseCase(seeded, presenceOf(undefined)).execute({
        gameId: seeded.gameId,
        participantId: anaId,
      }),
    ).rejects.toThrow(FacilitatorPresenceUnknownError);
  });

  it('sin seguimiento de presencia tampoco se puede tomar el relevo', async () => {
    const seeded = await seedGame();
    const anaId = await joinVoter(seeded, 'Ana');

    await expect(
      claimUseCase(seeded).execute({ gameId: seeded.gameId, participantId: anaId }),
    ).rejects.toThrow(FacilitatorPresenceUnknownError);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();

    await expect(
      claimUseCase(seeded, presenceOf([])).execute({
        gameId: 'inexistente',
        participantId: seeded.facilitatorId,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
