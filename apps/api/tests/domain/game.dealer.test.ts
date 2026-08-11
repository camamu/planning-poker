import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { RevealNotAllowedError } from '../../src/domain/game/Game.js';
import { IssueId, RoundId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW, nextId } from './support/gameFixtures.js';

describe('el dealer (docs/06-handoff-diseno.md §1) rota según la posición de la tarea entre los votantes', () => {
  it('el facilitador, primero por orden de entrada, reparte en la primera tarea', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    addVoter(game);
    addIssueAndOpenRound(game);

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });

  it('rota al segundo votante en la segunda tarea', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    const secondVoterId = addVoter(game);
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    const secondIssueId = IssueId.of(nextId('issue'));
    game.addIssue(secondIssueId, 'Otra tarea', NOW);
    game.startVotingRound(RoundId.of(nextId('round')), secondIssueId, NOW);

    expect(game.currentDealer()?.equals(secondVoterId)).toBe(true);
  });

  it('"volver a votar" la misma tarea no rota el dealer', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    addVoter(game);
    const { issueId } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });

  it('los espectadores nunca son elegidos como dealer', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    const spectatorId = addVoter(game);
    game.changeParticipantRole(spectatorId, 'SPECTATOR', NOW);
    addIssueAndOpenRound(game);

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });

  it('sin ninguna ronda todavía, no hay dealer', () => {
    const { game } = createGame({ whoCanReveal: 'DEALER' });
    expect(game.currentDealer()).toBeNull();
  });
});

describe('invariante 6 (whoCanReveal: DEALER): revelar exige ser el dealer de la tarea actual', () => {
  it('el dealer puede revelar', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(facilitatorId, NOW);
    }).not.toThrow();
  });

  it('un participante que no es el dealer no puede revelar', () => {
    const { game } = createGame({ whoCanReveal: 'DEALER' });
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(voterId, NOW);
    }).toThrow(RevealNotAllowedError);
  });
});
