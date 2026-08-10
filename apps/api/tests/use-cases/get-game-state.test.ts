import { describe, expect, it } from 'vitest';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';

describe('GetGameState', () => {
  it('devuelve la partida, sus participantes y la ronda abierta', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new GetGameState(seeded.context.games);

    const view = await useCase.execute({
      gameId: seeded.gameId,
      viewerId: seeded.facilitatorId,
    });

    expect(view.id).toBe(seeded.gameId);
    expect(view.participants).toHaveLength(1);
    expect(view.issues).toHaveLength(1);
    expect(view.currentRound?.id).toBe(seeded.roundId);
    expect(view.currentRound?.status).toBe('OPEN');
  });

  it('no expone el voto de otro participante antes del reveal (invariante 7)', async () => {
    const seeded = await seedGameWithOpenRound();
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

    const castVote = new CastVote(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );
    await castVote.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const useCase = new GetGameState(seeded.context.games);

    const viewOfVoter = await useCase.execute({ gameId: seeded.gameId, viewerId: voterId });
    const facilitatorVote = viewOfVoter.currentRound?.votes.find(
      (vote) => vote.participantId === seeded.facilitatorId,
    );
    expect(facilitatorVote).toEqual({
      participantId: seeded.facilitatorId,
      card: null,
      hasVoted: true,
    });

    const viewOfFacilitator = await useCase.execute({
      gameId: seeded.gameId,
      viewerId: seeded.facilitatorId,
    });
    const ownVote = viewOfFacilitator.currentRound?.votes.find(
      (vote) => vote.participantId === seeded.facilitatorId,
    );
    expect(ownVote).toEqual({ participantId: seeded.facilitatorId, card: '5', hasVoted: true });
  });

  it('expone los votos de todos tras el reveal', async () => {
    const seeded = await seedGameWithOpenRound();
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

    const castVote = new CastVote(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );
    await castVote.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });
    await castVote.execute({ gameId: seeded.gameId, participantId: voterId, card: '8' });

    const revealRound = new RevealRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );
    await revealRound.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });

    const useCase = new GetGameState(seeded.context.games);
    const view = await useCase.execute({ gameId: seeded.gameId, viewerId: voterId });

    expect(view.currentRound?.status).toBe('REVEALED');
    expect(new Set(view.currentRound?.votes.map((vote) => vote.card))).toEqual(new Set(['5', '8']));
    expect(view.currentRound?.result?.average).toBe(6.5);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new GetGameState(seeded.context.games);

    await expect(
      useCase.execute({ gameId: 'inexistente', viewerId: seeded.facilitatorId }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
