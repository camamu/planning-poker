import { describe, expect, it } from 'vitest';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { StartQuickRound } from '../../src/application/use-cases/StartQuickRound.js';
import { GameId, IssueId } from '../../src/domain/game/ids.js';
import { seedGame } from './support/gameFixtures.js';

describe('StartQuickRound', () => {
  it('crea una issue y abre una ronda sobre ella sin pasar por AddIssue', async () => {
    const seeded = await seedGame();
    const useCase = new StartQuickRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    const result = await useCase.execute({ gameId: seeded.gameId });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isOpen()).toBe(true);
    expect(stored?.findIssue(IssueId.of(result.issueId))?.currentStatus()).toBe('VOTING');
  });

  it('publica IssueAdded y VotingRoundStarted', async () => {
    const seeded = await seedGame();
    const useCase = new StartQuickRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await useCase.execute({ gameId: seeded.gameId });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual([
      'IssueAdded',
      'VotingRoundStarted',
    ]);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGame();
    const useCase = new StartQuickRound(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      seeded.context.ids,
    );

    await expect(useCase.execute({ gameId: 'inexistente' })).rejects.toThrow(GameNotFoundError);
  });
});
