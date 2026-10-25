import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { EditIssue } from '../../src/application/use-cases/EditIssue.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { InvalidIssueTitleError } from '../../src/domain/game/Issue.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';
import type { SeededGame } from './support/gameFixtures.js';

async function seedWithIssue(): Promise<{ seeded: SeededGame; issueId: string }> {
  const seeded = await seedGame();
  const { context, gameId } = seeded;
  const issueId = await new AddIssue(
    context.games,
    context.events,
    context.clock,
    context.ids,
  ).execute({ gameId, title: 'Implementar logn' });
  context.events.clear();
  return { seeded, issueId };
}

function editIssueUseCase(seeded: SeededGame): EditIssue {
  return new EditIssue(seeded.context.games, seeded.context.events, seeded.context.clock);
}

describe('EditIssue', () => {
  it('guarda el título nuevo y publica IssueEdited', async () => {
    const { seeded, issueId } = await seedWithIssue();

    await editIssueUseCase(seeded).execute({
      gameId: seeded.gameId,
      issueId,
      participantId: seeded.facilitatorId,
      title: 'Implementar login',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.findIssue(IssueId.of(issueId))?.title).toBe('Implementar login');
    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['IssueEdited']);
  });

  it('guarda la descripción y el enlace cuando se envían', async () => {
    const { seeded, issueId } = await seedWithIssue();

    await editIssueUseCase(seeded).execute({
      gameId: seeded.gameId,
      issueId,
      participantId: seeded.facilitatorId,
      title: 'Implementar login',
      description: 'Con OAuth',
      externalUrl: 'https://tracker.example.com/PP-1',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    const issue = stored?.findIssue(IssueId.of(issueId));
    expect(issue?.description).toBe('Con OAuth');
    expect(issue?.externalUrl).toBe('https://tracker.example.com/PP-1');
  });

  it('rechaza un título vacío sin guardar ni publicar nada', async () => {
    const { seeded, issueId } = await seedWithIssue();

    await expect(
      editIssueUseCase(seeded).execute({
        gameId: seeded.gameId,
        issueId,
        participantId: seeded.facilitatorId,
        title: '  ',
      }),
    ).rejects.toThrow(InvalidIssueTitleError);

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.findIssue(IssueId.of(issueId))?.title).toBe('Implementar logn');
    expect(seeded.context.events.published).toEqual([]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const { seeded, issueId } = await seedWithIssue();

    await expect(
      editIssueUseCase(seeded).execute({
        gameId: 'inexistente',
        issueId,
        participantId: seeded.facilitatorId,
        title: 'Implementar login',
      }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
