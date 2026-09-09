import { describe, expect, it } from 'vitest';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { RevealRound } from '../../src/application/use-cases/RevealRound.js';
import { SetFinalEstimate } from '../../src/application/use-cases/SetFinalEstimate.js';
import { CardNotInDeckError, RevealNotAllowedError } from '../../src/domain/game/Game.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';

async function seedRevealedRound(): Promise<Awaited<ReturnType<typeof seedGameWithOpenRound>>> {
  const seeded = await seedGameWithOpenRound();
  const castVote = new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock);
  await castVote.execute({
    gameId: seeded.gameId,
    participantId: seeded.facilitatorId,
    card: '5',
  });
  const reveal = new RevealRound(seeded.context.games, seeded.context.events, seeded.context.clock);
  await reveal.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });
  seeded.context.events.clear();
  return seeded;
}

describe('SetFinalEstimate', () => {
  it('cierra la issue como estimada con la carta acordada', async () => {
    const seeded = await seedRevealedRound();
    const useCase = new SetFinalEstimate(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    const issue = stored?.findIssue(IssueId.of(seeded.issueId));
    expect(issue?.currentStatus()).toBe('ESTIMATED');
    expect(issue?.currentFinalEstimate()?.raw).toBe('5');
  });

  it('publica IssueEstimated para que la mesa se entere', async () => {
    const seeded = await seedRevealedRound();
    const useCase = new SetFinalEstimate(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    expect(seeded.context.events.published.map((event) => event.type)).toContain('IssueEstimated');
  });

  it('no deja cerrar la estimación a quien no puede revelar', async () => {
    const seeded = await seedRevealedRound();
    const joinGame = new JoinGame(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    const participantId = await joinGame.execute({
      gameId: seeded.gameId,
      displayName: 'Bob',
      role: 'VOTER',
    });
    const useCase = new SetFinalEstimate(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({ gameId: seeded.gameId, participantId, card: '5' }),
    ).rejects.toBeInstanceOf(RevealNotAllowedError);
  });

  it('rechaza una estimación que no está en la baraja', async () => {
    const seeded = await seedRevealedRound();
    const useCase = new SetFinalEstimate(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId, card: '100' }),
    ).rejects.toBeInstanceOf(CardNotInDeckError);
  });
});
