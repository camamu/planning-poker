import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import {
  AnotherRoundOpenError,
  CardNotInDeckError,
  EstimateRequiresRevealedRoundError,
  NoOpenRoundError,
  RevealNotAllowedError,
  SpectatorCannotVoteError,
} from '../../src/domain/game/Game.js';
import { IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

describe('invariante 1: un voto solo se acepta si la carta pertenece a la baraja de la partida', () => {
  it('lanza CardNotInDeckError si la carta no está en la baraja', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    expect(() => {
      game.castVote(facilitatorId, CardValue.of('100'), NOW);
    }).toThrow(CardNotInDeckError);
  });

  it('acepta el voto si la carta pertenece a la baraja', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    expect(() => {
      game.castVote(facilitatorId, CardValue.of('5'), NOW);
    }).not.toThrow();
  });
});

describe('invariante 2: un espectador nunca puede votar', () => {
  it('lanza SpectatorCannotVoteError', () => {
    const { game } = createGame();
    const voterId = addVoter(game);
    game.changeParticipantRole(voterId, 'SPECTATOR', NOW);
    addIssueAndOpenRound(game);
    expect(() => {
      game.castVote(voterId, CardValue.of('5'), NOW);
    }).toThrow(SpectatorCannotVoteError);
  });
});

describe('invariante 3: no se puede votar en una ronda revelada o cerrada', () => {
  it('lanza NoOpenRoundError si se intenta votar tras revelar', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    expect(() => {
      game.castVote(facilitatorId, CardValue.of('8'), NOW);
    }).toThrow(NoOpenRoundError);
  });
});

describe('invariante 4: un participante tiene como máximo un voto por ronda; revotar sustituye', () => {
  it('sustituye el voto anterior en vez de acumular varios', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.castVote(facilitatorId, CardValue.of('8'), NOW);
    game.reveal(facilitatorId, NOW);

    const votes = game.currentRound()?.revealedVotes() ?? [];
    expect(votes).toHaveLength(1);
    expect(votes.at(0)?.card.raw).toBe('8');
  });
});

describe('invariante 5: solo una ronda abierta por partida a la vez', () => {
  it('lanza AnotherRoundOpenError al intentar abrir una segunda ronda', () => {
    const { game } = createGame();
    addIssueAndOpenRound(game);

    const secondIssueId = IssueId.of('second-issue');
    game.addIssue(secondIssueId, 'Otra tarea', NOW);

    expect(() => {
      game.startVotingRound(RoundId.of('second-round'), secondIssueId, NOW);
    }).toThrow(AnotherRoundOpenError);
  });

  it('permite abrir una nueva ronda una vez revelada la anterior', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    const secondIssueId = IssueId.of('second-issue');
    game.addIssue(secondIssueId, 'Otra tarea', NOW);

    expect(() => {
      game.startVotingRound(RoundId.of('second-round'), secondIssueId, NOW);
    }).not.toThrow();
  });
});

describe('invariante 6: revelar exige permiso según whoCanReveal', () => {
  it('FACILITATOR_ONLY: rechaza el reveal de quien no es facilitador', () => {
    const { game } = createGame({ whoCanReveal: 'FACILITATOR_ONLY' });
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(voterId, NOW);
    }).toThrow(RevealNotAllowedError);
  });

  it('FACILITATOR_ONLY: permite el reveal del facilitador', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'FACILITATOR_ONLY' });
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(facilitatorId, NOW);
    }).not.toThrow();
  });

  it('ANYONE: permite el reveal a cualquier participante registrado', () => {
    const { game } = createGame({ whoCanReveal: 'ANYONE' });
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(voterId, NOW);
    }).not.toThrow();
  });

  it('NAMED_LIST: solo permite el reveal a quien está en la lista', () => {
    const allowedId = ParticipantId.of('allowed-participant');
    const { game } = createGame({ whoCanReveal: 'NAMED_LIST', namedRevealers: [allowedId] });
    game.addParticipant(allowedId, DisplayName.of('Autorizado'), 'VOTER', NOW);
    const otherId = addVoter(game, 'Otro');
    addIssueAndOpenRound(game);

    expect(() => {
      game.reveal(otherId, NOW);
    }).toThrow(RevealNotAllowedError);
    expect(() => {
      game.reveal(allowedId, NOW);
    }).not.toThrow();
  });
});

describe('invariante 7: los votos de otros no se exponen hasta el reveal', () => {
  it('revealedVotes() lanza si la ronda todavía no se ha revelado', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    expect(() => game.currentRound()?.revealedVotes()).toThrow();
  });

  it('antes del reveal solo expone hasVoted (boolean), nunca el valor de la carta', () => {
    const { game, facilitatorId } = createGame();
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    const round = game.currentRound();
    expect(round?.hasVoted(facilitatorId)).toBe(true);
    expect(round?.hasVoted(voterId)).toBe(false);
  });

  it('tras el reveal, el valor de cada voto es legible', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    const votes = game.currentRound()?.revealedVotes() ?? [];
    expect(votes.at(0)?.card.raw).toBe('5');
  });
});

describe('invariante 8: autoReveal revela cuando todos los voters presentes han votado', () => {
  it('revela automáticamente al completar el último voto', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);

    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    expect(game.currentRound()?.isRevealed()).toBe(false);

    game.castVote(voterId, CardValue.of('8'), NOW);
    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('un espectador presente no bloquea el autoReveal', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const spectatorId = addVoter(game, 'Observador');
    game.changeParticipantRole(spectatorId, 'SPECTATOR', NOW);
    addIssueAndOpenRound(game);

    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    expect(game.currentRound()?.isRevealed()).toBe(true);
  });
});

describe('invariante 9: la media ignora las cartas especiales; sin ninguna numérica es null', () => {
  it('el resultado revelado descarta "?" al calcular la media', () => {
    const { game, facilitatorId } = createGame();
    const voterId = addVoter(game);
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.castVote(voterId, CardValue.of('?'), NOW);
    game.reveal(facilitatorId, NOW);

    expect(game.currentRound()?.revealedResult().average).toBe(5);
  });

  it('con una baraja sin cartas numéricas la media siempre es null', () => {
    const { game, facilitatorId } = createGame({ deck: Deck.tshirt() });
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('M'), NOW);
    game.reveal(facilitatorId, NOW);

    expect(game.currentRound()?.revealedResult().average).toBeNull();
  });
});

describe('invariante 10: cerrar una issue como estimada requiere una ronda revelada y una estimación final', () => {
  it('lanza EstimateRequiresRevealedRoundError si la ronda todavía está abierta', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);

    expect(() => {
      game.setFinalEstimate(CardValue.of('5'), facilitatorId, NOW);
    }).toThrow(EstimateRequiresRevealedRoundError);
  });

  it('marca la issue como ESTIMATED con la estimación elegida tras revelar', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);
    game.setFinalEstimate(CardValue.of('5'), facilitatorId, NOW);

    const issue = game.findIssue(issueId);
    expect(issue?.currentStatus()).toBe('ESTIMATED');
    expect(issue?.currentFinalEstimate()?.raw).toBe('5');
    expect(game.currentRound()?.currentStatus()).toBe('CLOSED');
  });
});
