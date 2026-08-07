import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

describe('AddIssue', () => {
  it('añade la issue a la partida y devuelve su id', async () => {
    const seeded = await seedGame();
    const useCase = new AddIssue(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    const issueId = await useCase.execute({ gameId: seeded.gameId, title: 'Implementar login' });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.findIssue(IssueId.of(issueId))?.title).toBe('Implementar login');
  });

  it('publica IssueAdded', async () => {
    const seeded = await seedGame();
    const useCase = new AddIssue(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await useCase.execute({ gameId: seeded.gameId, title: 'Implementar login' });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['IssueAdded']);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const useCase = new AddIssue(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await expect(
      useCase.execute({ gameId: 'inexistente', title: 'Implementar login' }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
