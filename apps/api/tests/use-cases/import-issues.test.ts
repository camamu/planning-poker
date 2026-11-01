import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { ImportIssues } from '../../src/application/use-cases/ImportIssues.js';
import { InvalidIssueTitleError } from '../../src/domain/game/Issue.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

async function setUp(): Promise<{
  seeded: Awaited<ReturnType<typeof seedGame>>;
  useCase: ImportIssues;
}> {
  const seeded = await seedGame();
  const { games, events, clock, ids } = seeded.context;
  return { seeded, useCase: new ImportIssues(games, events, clock, ids) };
}

describe('ImportIssues', () => {
  it('añade todas las tareas con su descripción y enlace y devuelve sus ids en orden', async () => {
    const { seeded, useCase } = await setUp();

    const issueIds = await useCase.execute({
      gameId: seeded.gameId,
      issues: [
        { title: 'ABC-1', externalUrl: 'https://jira.test/browse/ABC-1' },
        { title: 'ABC-2', description: 'Segunda' },
      ],
    });

    expect(issueIds).toHaveLength(2);
    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    const [first, second] = issueIds.map((id) => stored?.findIssue(IssueId.of(id)));
    expect(first?.title).toBe('ABC-1');
    expect(first?.externalUrl).toBe('https://jira.test/browse/ABC-1');
    expect(second?.description).toBe('Segunda');
    expect(stored?.allIssues().map((issue) => issue.id.value)).toEqual(issueIds);
  });

  it('publica un único IssuesImported por toda la importación', async () => {
    const { seeded, useCase } = await setUp();

    await useCase.execute({
      gameId: seeded.gameId,
      issues: [{ title: 'Primera' }, { title: 'Segunda' }, { title: 'Tercera' }],
    });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['IssuesImported']);
  });

  it('no guarda ni publica nada si una tarea tiene el título vacío', async () => {
    const { seeded, useCase } = await setUp();

    await expect(
      useCase.execute({ gameId: seeded.gameId, issues: [{ title: 'Primera' }, { title: ' ' }] }),
    ).rejects.toThrow(InvalidIssueTitleError);

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.allIssues()).toEqual([]);
    expect(seeded.context.events.published).toEqual([]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const { useCase } = await setUp();

    await expect(
      useCase.execute({ gameId: 'inexistente', issues: [{ title: 'Primera' }] }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
