import { describe, expect, it } from 'vitest';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { RevealNotAllowedError } from '../../src/domain/game/Game.js';
import { GameId } from '../../src/domain/game/ids.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';

describe('RevealRound', () => {
  it('revela la ronda cuando el participante tiene permiso', async () => {
    const seeded = await seedGameWithOpenRound();
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
    seeded.context.events.clear();

    const useCase = new RevealRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );
    await useCase.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(true);
  });

  it('publica RoundRevealed', async () => {
    const seeded = await seedGameWithOpenRound();
    seeded.context.events.clear();

    const useCase = new RevealRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );
    await useCase.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['RoundRevealed']);
  });

  it('lanza RevealNotAllowedError si el participante no tiene permiso bajo FACILITATOR_ONLY', async () => {
    const seeded = await seedGameWithOpenRound({ whoCanReveal: 'FACILITATOR_ONLY' });
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

    const useCase = new RevealRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({ gameId: seeded.gameId, participantId: voterId }),
    ).rejects.toThrow(RevealNotAllowedError);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new RevealRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({ gameId: 'inexistente', participantId: seeded.facilitatorId }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
