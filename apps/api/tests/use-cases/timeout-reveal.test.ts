import { describe, expect, it } from 'vitest';
import { TimeoutReveal } from '../../src/application/use-cases/TimeoutReveal.js';
import { GameNotFoundError } from '../../src/application/use-cases/GameNotFoundError.js';
import { GameId } from '../../src/domain/game/ids.js';
import { NOW } from './support/context.js';
import { FixedClock } from './support/FixedClock.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';

describe('TimeoutReveal', () => {
  it('revela la ronda una vez cumplida la fecha límite, sin comprobar quién puede revelar', async () => {
    const seeded = await seedGameWithOpenRound({
      countdownSeconds: 45,
      whoCanReveal: 'FACILITATOR_ONLY',
    });

    const useCase = new TimeoutReveal(
      seeded.context.games,
      seeded.context.events,
      new FixedClock(new Date(NOW.getTime() + 45_000)),
    );
    await useCase.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(true);
  });

  it('no revela si todavía no se ha cumplido la fecha límite', async () => {
    const seeded = await seedGameWithOpenRound({ countdownSeconds: 45 });

    const useCase = new TimeoutReveal(
      seeded.context.games,
      seeded.context.events,
      new FixedClock(new Date(NOW.getTime() + 10_000)),
    );
    await useCase.execute({ gameId: seeded.gameId, participantId: seeded.facilitatorId });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(false);
  });

  it('lanza GameNotFoundError si la partida no existe', async () => {
    const seeded = await seedGameWithOpenRound({ countdownSeconds: 45 });
    const useCase = new TimeoutReveal(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
    );

    await expect(
      useCase.execute({ gameId: 'inexistente', participantId: seeded.facilitatorId }),
    ).rejects.toThrow(GameNotFoundError);
  });
});
