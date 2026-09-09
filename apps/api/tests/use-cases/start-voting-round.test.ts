import { describe, expect, it } from 'vitest';
import { AddIssue } from '../../src/application/use-cases/AddIssue.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { StartVotingRound } from '../../src/application/use-cases/StartVotingRound.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

describe('StartVotingRound', () => {
  it('abre una ronda sobre la issue indicada', async () => {
    const seeded = await seedGame();
    const addIssue = new AddIssue(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    const issueId = await addIssue.execute({ gameId: seeded.gameId, title: 'Implementar login' });
    seeded.context.events.clear();

    const useCase = new StartVotingRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    await useCase.execute({ gameId: seeded.gameId, issueId });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isOpen()).toBe(true);
    expect(stored?.findIssue(IssueId.of(issueId))?.currentStatus()).toBe('VOTING');
  });

  it('publica VotingRoundStarted', async () => {
    const seeded = await seedGame();
    const addIssue = new AddIssue(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    const issueId = await addIssue.execute({ gameId: seeded.gameId, title: 'Implementar login' });
    seeded.context.events.clear();

    const useCase = new StartVotingRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );
    await useCase.execute({ gameId: seeded.gameId, issueId });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'VotingRoundStarted',
    ]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const useCase = new StartVotingRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await expect(useCase.execute({ gameId: 'inexistente', issueId: 'issue-1' })).rejects.toThrow(
      GameNotFoundError,
    );
  });
});
