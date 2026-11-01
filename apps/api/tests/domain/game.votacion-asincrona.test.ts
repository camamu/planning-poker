import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { Deck } from '../../src/domain/deck/Deck.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import {
  AnotherRoundOpenError,
  CardNotInDeckError,
  DeckChangeDuringVotingError,
  EstimateRequiresRevealedRoundError,
  IssueHasRoundsError,
  IssueNotFoundError,
  IssueNotPendingError,
  NoOpenAsyncRoundError,
  RevealNotAllowedError,
  SpectatorCannotVoteError,
  VoteChangeNotAllowedError,
} from '../../src/domain/game/Game.js';
import type { Game } from '../../src/domain/game/Game.js';
import type { Round } from '../../src/domain/game/Round.js';
import { IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { NOW, addIssueAndOpenRound, addVoter, createGame, nextId } from './support/gameFixtures.js';

const five = CardValue.of('5');
const eight = CardValue.of('8');

function addIssue(game: Game, title = 'Tarea'): IssueId {
  const issueId = IssueId.of(nextId('issue'));
  game.addIssue(issueId, title, NOW);
  return issueId;
}

function openAsync(game: Game, requestedBy: ParticipantId, ...issueIds: IssueId[]): RoundId[] {
  const entries = issueIds.map((issueId) => ({ roundId: RoundId.of(nextId('round')), issueId }));
  game.openAsyncRounds(entries, requestedBy, NOW);
  return entries.map((entry) => entry.roundId);
}

function asyncRoundOf(game: Game, issueId: IssueId): Round {
  const round = game.roundsOf(issueId).find((candidate) => candidate.isAsync());
  if (!round) throw new Error('la tarea no tiene ronda asíncrona');
  return round;
}

describe('abrir rondas en diferido', () => {
  it('se pueden tener abiertas varias rondas asíncronas a la vez', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game);
    const second = addIssue(game);

    openAsync(game, facilitatorId, first, second);

    expect(asyncRoundOf(game, first).isOpen()).toBe(true);
    expect(asyncRoundOf(game, second).isOpen()).toBe(true);
    expect(game.activeAsyncRounds()).toHaveLength(2);
  });

  it('una ronda asíncrona no impide abrir una ronda en vivo', () => {
    const { game, facilitatorId } = createGame();
    const deferred = addIssue(game);
    openAsync(game, facilitatorId, deferred);

    const { issueId: live } = addIssueAndOpenRound(game);

    expect(game.currentRound()?.issueId.equals(live)).toBe(true);
    expect(game.currentRound()?.isOpen()).toBe(true);
    expect(asyncRoundOf(game, deferred).isOpen()).toBe(true);
  });

  it('una ronda en vivo abierta no impide abrir rondas asíncronas', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    const deferred = addIssue(game);

    openAsync(game, facilitatorId, deferred);

    expect(asyncRoundOf(game, deferred).isOpen()).toBe(true);
  });

  it('la ronda actual sigue siendo la de la mesa aunque se abran rondas asíncronas después', () => {
    const { game, facilitatorId } = createGame();
    const { roundId } = addIssueAndOpenRound(game);

    openAsync(game, facilitatorId, addIssue(game));

    expect(game.currentRound()?.id.equals(roundId)).toBe(true);
  });

  it('no se puede abrir en diferido una tarea ya estimada', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, five, NOW);
    game.reveal(facilitatorId, NOW);
    game.setFinalEstimate(five, facilitatorId, NOW);

    expect(() => {
      openAsync(game, facilitatorId, issueId);
    }).toThrow(IssueNotPendingError);
  });

  it('no se puede abrir en diferido la tarea que está en la mesa', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);

    expect(() => {
      openAsync(game, facilitatorId, issueId);
    }).toThrow(IssueNotPendingError);
  });

  it('no se puede abrir en diferido una tarea que ya está abierta en diferido', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    expect(() => {
      openAsync(game, facilitatorId, issueId);
    }).toThrow(IssueNotPendingError);
  });

  it('no se puede abrir la misma tarea dos veces en el mismo lote', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);

    expect(() => {
      openAsync(game, facilitatorId, issueId, issueId);
    }).toThrow(IssueNotPendingError);
    expect(game.roundsOf(issueId)).toEqual([]);
  });

  it('abrir en diferido es todo o nada: una tarea inválida deja el resto sin abrir', () => {
    const { game, facilitatorId } = createGame();
    const valid = addIssue(game);
    const { issueId: onTable } = addIssueAndOpenRound(game);
    game.pullDomainEvents();

    expect(() => {
      openAsync(game, facilitatorId, valid, onTable);
    }).toThrow(IssueNotPendingError);

    expect(game.roundsOf(valid)).toEqual([]);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('no se puede abrir en diferido una tarea que no existe', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      openAsync(game, facilitatorId, IssueId.of('fantasma'));
    }).toThrow(IssueNotFoundError);
  });

  it('abrir una lista vacía no cambia nada ni emite eventos', () => {
    const { game, facilitatorId } = createGame();
    game.pullDomainEvents();

    game.openAsyncRounds([], facilitatorId, NOW);

    expect(game.allRounds()).toEqual([]);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('numera las rondas asíncronas junto con las demás rondas de la tarea', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    openAsync(game, facilitatorId, issueId);

    expect(game.roundsOf(issueId).map((round) => round.roundNumber)).toEqual([1, 2]);
  });

  it('la ronda asíncrona no lleva cuenta atrás aunque la partida la tenga', () => {
    const { game, facilitatorId } = createGame({ countdownSeconds: 30 });
    const issueId = addIssue(game);

    openAsync(game, facilitatorId, issueId);

    expect(asyncRoundOf(game, issueId).currentTimerDeadline()).toBeNull();
  });

  it('registra un único evento con todas las rondas abiertas', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game);
    const second = addIssue(game);
    game.pullDomainEvents();

    openAsync(game, facilitatorId, first, second);

    const events = game.pullDomainEvents();
    expect(events.map((event) => event.type)).toEqual(['AsyncRoundsOpened']);
  });
});

describe('votar en diferido', () => {
  it('guarda el voto en la ronda asíncrona de la tarea y no en la de la mesa', () => {
    const { game, facilitatorId } = createGame();
    const { roundId } = addIssueAndOpenRound(game);
    const deferred = addIssue(game);
    openAsync(game, facilitatorId, deferred);

    game.castAsyncVote(facilitatorId, deferred, five, NOW);

    expect(asyncRoundOf(game, deferred).hasVoted(facilitatorId)).toBe(true);
    expect(game.currentRound()?.id.equals(roundId)).toBe(true);
    expect(game.currentRound()?.hasVoted(facilitatorId)).toBe(false);
  });

  it('un espectador no puede votar en diferido', () => {
    const { game, facilitatorId } = createGame();
    const spectatorId = ParticipantId.of(nextId('participant'));
    game.addParticipant(spectatorId, DisplayName.of('Mirón'), 'SPECTATOR', NOW);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    expect(() => {
      game.castAsyncVote(spectatorId, issueId, five, NOW);
    }).toThrow(SpectatorCannotVoteError);
  });

  it('no se puede votar en diferido una carta que no está en la baraja', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    expect(() => {
      game.castAsyncVote(facilitatorId, issueId, CardValue.of('XL'), NOW);
    }).toThrow(CardNotInDeckError);
  });

  it('no se puede votar en diferido una tarea sin ronda asíncrona abierta', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);

    expect(() => {
      game.castAsyncVote(facilitatorId, issueId, five, NOW);
    }).toThrow(NoOpenAsyncRoundError);
  });

  it('no se puede votar en diferido una ronda que ya se ha revelado', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(() => {
      game.castAsyncVote(facilitatorId, issueId, eight, NOW);
    }).toThrow(NoOpenAsyncRoundError);
  });

  it('votar en diferido nunca revela automáticamente', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const other = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.castAsyncVote(other, issueId, five, NOW);

    expect(asyncRoundOf(game, issueId).isOpen()).toBe(true);
  });

  it('permite cambiar el voto en diferido cuando la partida lo permite', () => {
    const { game, facilitatorId } = createGame({ allowVoteChange: true });
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    game.castAsyncVote(facilitatorId, issueId, eight, NOW);

    expect(asyncRoundOf(game, issueId).hasSameVote(facilitatorId, eight)).toBe(true);
  });

  it('no permite cambiar el voto en diferido cuando la partida no lo permite', () => {
    const { game, facilitatorId } = createGame({ allowVoteChange: false });
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    expect(() => {
      game.castAsyncVote(facilitatorId, issueId, eight, NOW);
    }).toThrow(VoteChangeNotAllowedError);
  });

  it('repetir el mismo voto en diferido no genera un evento nuevo', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.pullDomainEvents();

    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('registra quién ha votado y en qué tarea, sin la carta', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.pullDomainEvents();

    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    const [event] = game.pullDomainEvents();
    expect(event).toMatchObject({ type: 'AsyncVoteCast', participantId: facilitatorId, issueId });
    expect(JSON.stringify(event)).not.toContain('"5"');
  });
});

describe('revelar en lote', () => {
  it('revela todas las rondas asíncronas abiertas que tienen votos', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game);
    const second = addIssue(game);
    openAsync(game, facilitatorId, first, second);
    game.castAsyncVote(facilitatorId, first, five, NOW);
    game.castAsyncVote(facilitatorId, second, eight, NOW);

    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(asyncRoundOf(game, first).isRevealed()).toBe(true);
    expect(asyncRoundOf(game, second).isRevealed()).toBe(true);
    expect(asyncRoundOf(game, first).revealedResult().mostVoted?.raw).toBe('5');
  });

  it('revelar en lote ignora las rondas sin votos', () => {
    const { game, facilitatorId } = createGame();
    const voted = addIssue(game);
    const empty = addIssue(game);
    openAsync(game, facilitatorId, voted, empty);
    game.castAsyncVote(facilitatorId, voted, five, NOW);

    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(asyncRoundOf(game, voted).isRevealed()).toBe(true);
    expect(asyncRoundOf(game, empty).isOpen()).toBe(true);
  });

  it('revela solo las tareas indicadas', () => {
    const { game, facilitatorId } = createGame();
    const chosen = addIssue(game);
    const other = addIssue(game);
    openAsync(game, facilitatorId, chosen, other);
    game.castAsyncVote(facilitatorId, chosen, five, NOW);
    game.castAsyncVote(facilitatorId, other, five, NOW);

    game.revealAsyncRounds([chosen], facilitatorId, NOW);

    expect(asyncRoundOf(game, chosen).isRevealed()).toBe(true);
    expect(asyncRoundOf(game, other).isOpen()).toBe(true);
  });

  it('no emite nada si no hay ninguna ronda con votos que revelar', () => {
    const { game, facilitatorId } = createGame();
    openAsync(game, facilitatorId, addIssue(game));
    game.pullDomainEvents();

    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('ignora una tarea indicada que ya no tiene ronda asíncrona abierta', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds([issueId], facilitatorId, NOW);
    game.pullDomainEvents();

    game.revealAsyncRounds([issueId], facilitatorId, NOW);

    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('no revela una tarea que no existe', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.revealAsyncRounds([IssueId.of('fantasma')], facilitatorId, NOW);
    }).toThrow(IssueNotFoundError);
  });

  it('exige el mismo permiso que el revelado en vivo', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'FACILITATOR_ONLY' });
    const voter = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(voter, issueId, five, NOW);

    expect(() => {
      game.revealAsyncRounds('ALL', voter, NOW);
    }).toThrow(RevealNotAllowedError);
    expect(asyncRoundOf(game, issueId).isOpen()).toBe(true);
  });

  it('con el reparto «dealer» y sin ronda en vivo, decide el facilitador', () => {
    const { game, facilitatorId } = createGame({ whoCanReveal: 'DEALER' });
    const voter = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(voter, issueId, five, NOW);

    expect(() => {
      game.revealAsyncRounds('ALL', voter, NOW);
    }).toThrow(RevealNotAllowedError);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(asyncRoundOf(game, issueId).isRevealed()).toBe(true);
  });

  it('registra un único evento con las rondas reveladas', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game);
    const second = addIssue(game);
    openAsync(game, facilitatorId, first, second);
    game.castAsyncVote(facilitatorId, first, five, NOW);
    game.castAsyncVote(facilitatorId, second, five, NOW);
    game.pullDomainEvents();

    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['AsyncRoundsRevealed']);
  });
});

describe('pasar una tarea en diferido a la mesa', () => {
  it('abrir en vivo una tarea en diferido conserva sus votos', () => {
    const { game, facilitatorId } = createGame();
    const voter = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.castAsyncVote(voter, issueId, eight, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    const live = game.currentRound();
    expect(live?.isLive()).toBe(true);
    expect(live?.isOpen()).toBe(true);
    expect(live?.hasSameVote(facilitatorId, five)).toBe(true);
    expect(live?.hasSameVote(voter, eight)).toBe(true);
  });

  it('retira la ronda asíncrona y no deja dos rondas abiertas sobre la misma tarea', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.roundsOf(issueId)).toHaveLength(1);
    expect(game.roundsOf(issueId)[0]?.roundNumber).toBe(1);
    expect(game.activeAsyncRounds()).toEqual([]);
  });

  it('no toca las rondas asíncronas de otras tareas', () => {
    const { game, facilitatorId } = createGame();
    const onTable = addIssue(game);
    const other = addIssue(game);
    openAsync(game, facilitatorId, onTable, other);

    game.startVotingRound(RoundId.of(nextId('round')), onTable, NOW);

    expect(asyncRoundOf(game, other).isOpen()).toBe(true);
  });

  it('revela al instante si los votos en diferido ya completan la ronda con el auto-revelado', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const voter = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.castAsyncVote(voter, issueId, five, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('no revela al abrir en vivo si falta alguien por votar', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.currentRound()?.isOpen()).toBe(true);
  });

  it('no revela al abrir en vivo una tarea sin votos en diferido', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.currentRound()?.isOpen()).toBe(true);
  });

  it('una ronda en vivo abierta sigue impidiendo abrir otra, también sobre una tarea en diferido', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    expect(() => {
      game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);
    }).toThrow(AnotherRoundOpenError);
    expect(asyncRoundOf(game, issueId).isOpen()).toBe(true);
  });

  it('volver a votar en vivo una tarea revelada en diferido empieza una ronda nueva sin votos', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(game.currentRound()?.roundNumber).toBe(2);
    expect(game.currentRound()?.voteCount()).toBe(0);
    expect(game.activeAsyncRounds()).toEqual([]);
  });
});

describe('estimar tareas reveladas en diferido', () => {
  it('estima la tarea indicada y cierra su ronda asíncrona', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.setFinalEstimate(five, facilitatorId, NOW, issueId);

    expect(game.findIssue(issueId)?.currentStatus()).toBe('ESTIMATED');
    expect(game.findIssue(issueId)?.currentFinalEstimate()?.raw).toBe('5');
    expect(asyncRoundOf(game, issueId).currentStatus()).toBe('CLOSED');
    expect(game.activeAsyncRounds()).toEqual([]);
  });

  it('estimar una tarea en diferido no toca la ronda de la mesa', () => {
    const { game, facilitatorId } = createGame();
    const { roundId } = addIssueAndOpenRound(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.setFinalEstimate(five, facilitatorId, NOW, issueId);

    expect(game.currentRound()?.id.equals(roundId)).toBe(true);
    expect(game.currentRound()?.isOpen()).toBe(true);
  });

  it('no se puede estimar una tarea cuya ronda asíncrona sigue abierta', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);

    expect(() => {
      game.setFinalEstimate(five, facilitatorId, NOW, issueId);
    }).toThrow(EstimateRequiresRevealedRoundError);
  });

  it('no se puede estimar una tarea que nunca se ha votado', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.setFinalEstimate(five, facilitatorId, NOW, addIssue(game));
    }).toThrow(EstimateRequiresRevealedRoundError);
  });

  it('estimar con una carta fuera de la baraja se rechaza también en diferido', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(() => {
      game.setFinalEstimate(CardValue.of('XL'), facilitatorId, NOW, issueId);
    }).toThrow(CardNotInDeckError);
  });

  it('solo quien puede revelar puede estimar una tarea en diferido', () => {
    const { game, facilitatorId } = createGame();
    const voter = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(voter, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    expect(() => {
      game.setFinalEstimate(five, voter, NOW, issueId);
    }).toThrow(RevealNotAllowedError);
  });

  it('sin indicar tarea sigue cerrando la ronda actual de la mesa', () => {
    const { game, facilitatorId } = createGame();
    const deferred = addIssue(game);
    openAsync(game, facilitatorId, deferred);
    const { issueId: live } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, five, NOW);
    game.reveal(facilitatorId, NOW);

    game.setFinalEstimate(five, facilitatorId, NOW);

    expect(game.findIssue(live)?.currentStatus()).toBe('ESTIMATED');
    expect(game.findIssue(deferred)?.currentStatus()).toBe('PENDING');
    expect(asyncRoundOf(game, deferred).isOpen()).toBe(true);
  });
});

describe('rondas asíncronas y el resto de la partida', () => {
  it('no se puede cambiar la baraja con rondas asíncronas abiertas', () => {
    const { game, facilitatorId } = createGame();
    openAsync(game, facilitatorId, addIssue(game));

    expect(() => {
      game.changeDeck(Deck.tshirt(), facilitatorId, NOW);
    }).toThrow(DeckChangeDuringVotingError);
  });

  it('se puede cambiar la baraja cuando las rondas asíncronas ya están reveladas', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.changeDeck(Deck.tshirt(), facilitatorId, NOW);

    expect(game.currentDeck().contains(CardValue.of('XL'))).toBe(true);
  });

  it('no se puede borrar una tarea con una ronda asíncrona abierta', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);

    expect(() => {
      game.removeIssue(issueId, facilitatorId, NOW);
    }).toThrow(IssueHasRoundsError);
  });

  it('al salir un participante se retiran sus votos de las rondas asíncronas abiertas', () => {
    const { game, facilitatorId } = createGame();
    const leaver = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(leaver, issueId, five, NOW);
    game.castAsyncVote(facilitatorId, issueId, eight, NOW);

    game.removeParticipant(leaver, leaver, NOW);

    const round = asyncRoundOf(game, issueId);
    expect(round.hasVoted(leaver)).toBe(false);
    expect(round.hasVoted(facilitatorId)).toBe(true);
  });

  it('al salir un participante se conservan sus votos en las rondas asíncronas ya reveladas', () => {
    const { game, facilitatorId } = createGame();
    const leaver = addVoter(game);
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(leaver, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.removeParticipant(leaver, leaver, NOW);

    expect(asyncRoundOf(game, issueId).hasVoted(leaver)).toBe(true);
  });

  it('las rondas asíncronas no cambian quién es el dealer', () => {
    const { game, facilitatorId } = createGame();
    addVoter(game);
    addIssueAndOpenRound(game);
    const before = game.currentDealer();

    openAsync(game, facilitatorId, addIssue(game));

    expect(game.currentDealer()).toEqual(before);
  });

  it('las rondas asíncronas reveladas cuentan como rondas anteriores de la tarea', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game);
    openAsync(game, facilitatorId, issueId);
    game.castAsyncVote(facilitatorId, issueId, five, NOW);
    game.revealAsyncRounds('ALL', facilitatorId, NOW);

    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    const [first, second] = game.roundsOf(issueId);
    expect(first?.isAsync()).toBe(true);
    expect(first?.isRevealed()).toBe(true);
    expect(second?.isLive()).toBe(true);
  });
});
