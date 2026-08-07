import { describe, expect, it } from 'vitest';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';

describe('CastVote', () => {
  it('registra el voto del facilitador en la ronda abierta', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock);

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.hasVoted(ParticipantId.of(seeded.facilitatorId))).toBe(true);
  });

  it('publica VoteCast', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock);

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['VoteCast']);
  });

  it('dispara el reveal automático cuando autoReveal está activo y ha votado el único votante', async () => {
    const seeded = await seedGameWithOpenRound({ autoReveal: true });
    const useCase = new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock);

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(true);
    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'VoteCast',
      'RoundRevealed',
    ]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGameWithOpenRound();
    const useCase = new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock);

    await expect(
      useCase.execute({ gameId: 'inexistente', participantId: seeded.facilitatorId, card: '5' }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
