import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { RemoveIssue } from '../../src/application/use-cases/RemoveIssue.js';
import { IssueHasRoundsError } from '../../src/domain/game/Game.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame, seedGameWithOpenRound } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

function removeIssueUseCase(seeded: SeededGame): RemoveIssue {
  return new RemoveIssue(seeded.context.games, seeded.context.events, seeded.context.clock);
}

describe('RemoveIssue', () => {
  it('borra la tarea y publica IssueRemoved', async () => {
    const seeded = await seedGame();
    const { context, gameId, facilitatorId } = seeded;
    const issueId = await new AddIssue(
      context.games,
      context.events,
      context.clock,
      context.ids,
    ).execute({ gameId, title: 'Implementar login' });
    context.events.clear();

    await removeIssueUseCase(seeded).execute({ gameId, issueId, participantId: facilitatorId });

    const stored = await context.games.findById(GameId.of(gameId));
    expect(stored?.findIssue(IssueId.of(issueId))).toBeUndefined();
    expect(context.events.published.map((event) => event.type)).toEqual(['IssueRemoved']);
  });

  it('rechaza borrar la tarea de una ronda sin guardar ni publicar nada', async () => {
    const seeded = await seedGameWithOpenRound();
    const { context, gameId, facilitatorId, issueId } = seeded;

    await expect(
      removeIssueUseCase(seeded).execute({ gameId, issueId, participantId: facilitatorId }),
    ).rejects.toThrow(IssueHasRoundsError);

    const stored = await context.games.findById(GameId.of(gameId));
    expect(stored?.findIssue(IssueId.of(issueId))).toBeDefined();
    expect(context.events.published).toEqual([]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();

    await expect(
      removeIssueUseCase(seeded).execute({
        gameId: 'inexistente',
        issueId: 'cualquiera',
        participantId: seeded.facilitatorId,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
