import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { ReorderIssues } from '../../src/application/use-cases/ReorderIssues.js';
import { InvalidIssueOrderError } from '../../src/domain/game/Game.js';
import { GameId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

async function seedWithIssues(): Promise<{ seeded: SeededGame; issueIds: string[] }> {
  const seeded = await seedGame();
  const { context, gameId } = seeded;
  const addIssue = new AddIssue(context.games, context.events, context.clock, context.ids);
  const issueIds = [
    await addIssue.execute({ gameId, title: 'Primera' }),
    await addIssue.execute({ gameId, title: 'Segunda' }),
    await addIssue.execute({ gameId, title: 'Tercera' }),
  ];
  context.events.clear();
  return { seeded, issueIds };
}

function reorderIssuesUseCase(seeded: SeededGame): ReorderIssues {
  return new ReorderIssues(seeded.context.games, seeded.context.events, seeded.context.clock);
}

describe('ReorderIssues', () => {
  it('guarda el orden nuevo y publica IssuesReordered', async () => {
    const { seeded, issueIds } = await seedWithIssues();
    const [first, second, third] = issueIds;
    if (!first || !second || !third) throw new Error('faltan tareas en el fixture');

    await reorderIssuesUseCase(seeded).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      issueIds: [third, first, second],
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.allIssues().map((issue) => issue.title)).toEqual([
      'Tercera',
      'Primera',
      'Segunda',
    ]);
    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['IssuesReordered']);
  });

  it('rechaza un orden parcial sin guardar ni publicar nada', async () => {
    const { seeded, issueIds } = await seedWithIssues();

    await expect(
      reorderIssuesUseCase(seeded).execute({
        gameId: seeded.gameId,
        participantId: seeded.facilitatorId,
        issueIds: issueIds.slice(1),
      }),
    ).rejects.toThrow(InvalidIssueOrderError);

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.allIssues().map((issue) => issue.title)).toEqual([
      'Primera',
      'Segunda',
      'Tercera',
    ]);
    expect(seeded.context.events.published).toEqual([]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const { seeded, issueIds } = await seedWithIssues();

    await expect(
      reorderIssuesUseCase(seeded).execute({
        gameId: 'inexistente',
        participantId: seeded.facilitatorId,
        issueIds,
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
