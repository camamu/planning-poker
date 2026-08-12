import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

describe('F5 — cuenta atrás: la ronda se abre con la fecha límite calculada a partir de countdownSeconds', () => {
  it('con countdownSeconds configurado, guarda now + countdownSeconds como fecha límite', () => {
    const { game } = createGame({ countdownSeconds: 45 });
    addIssueAndOpenRound(game);

    expect(game.currentRound()?.currentTimerDeadline()).toEqual(new Date(NOW.getTime() + 45_000));
  });

  it('sin countdownSeconds configurado, la ronda no tiene fecha límite', () => {
    const { game } = createGame({ countdownSeconds: null });
    addIssueAndOpenRound(game);

    expect(game.currentRound()?.currentTimerDeadline()).toBeNull();
  });
});

describe('F5 — revealOnTimeout: reveal disparado por el cliente, validado por el servidor', () => {
  it('no revela si todavía no se ha cumplido la fecha límite', () => {
    const { game, facilitatorId } = createGame({ countdownSeconds: 45 });
    addIssueAndOpenRound(game);

    const beforeDeadline = new Date(NOW.getTime() + 10_000);
    game.revealOnTimeout(facilitatorId, beforeDeadline);

    expect(game.currentRound()?.isRevealed()).toBe(false);
  });

  it('revela una vez cumplida la fecha límite, sin comprobar quién puede revelar', () => {
    const { game } = createGame({ countdownSeconds: 45, whoCanReveal: 'FACILITATOR_ONLY' });
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);

    const afterDeadline = new Date(NOW.getTime() + 45_000);
    // voterId no es facilitador y whoCanReveal es FACILITATOR_ONLY: un reveal() manual suyo
    // fallaría, pero revealOnTimeout() es una acción del sistema, no del participante.
    game.revealOnTimeout(voterId, afterDeadline);

    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('es idempotente si ya no hay ronda abierta', () => {
    const { game, facilitatorId } = createGame({ countdownSeconds: 45 });
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    const afterDeadline = new Date(NOW.getTime() + 45_000);
    expect(() => {
      game.revealOnTimeout(facilitatorId, afterDeadline);
    }).not.toThrow();
  });
});
