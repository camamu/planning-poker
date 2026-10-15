import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import {
  FacilitatorCannotLeaveError,
  ParticipantNotFoundError,
  ParticipantRemovalNotAllowedError,
} from '../../src/domain/game/Game.js';
import { NOW, addIssueAndOpenRound, addVoter, createGame } from './support/gameFixtures.js';

const card = (raw: string): CardValue => CardValue.of(raw);

describe('salida de participantes', () => {
  it('permite que un participante salga por su cuenta y deja de ser votante', () => {
    const { game } = createGame();
    const ana = addVoter(game, 'Ana');
    game.pullDomainEvents();

    game.removeParticipant(ana, ana, NOW);

    expect(game.hasParticipantLeft(ana)).toBe(true);
    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['ParticipantLeft']);
  });

  it('permite que el facilitador quite a otro participante', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');

    game.removeParticipant(ana, facilitatorId, NOW);

    expect(game.hasParticipantLeft(ana)).toBe(true);
  });

  it('no permite que un participante quite a otro si no es el facilitador', () => {
    const { game } = createGame();
    const ana = addVoter(game, 'Ana');
    const bea = addVoter(game, 'Bea');

    expect(() => {
      game.removeParticipant(bea, ana, NOW);
    }).toThrow(ParticipantRemovalNotAllowedError);
  });

  it('no permite que el facilitador salga de la partida', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.removeParticipant(facilitatorId, facilitatorId, NOW);
    }).toThrow(FacilitatorCannotLeaveError);
  });

  it('no permite votar a quien ya ha salido', () => {
    const { game } = createGame();
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.castVote(ana, card('5'), NOW);
    }).toThrow(ParticipantNotFoundError);
  });

  it('retira el voto de la ronda abierta de quien sale', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.castVote(ana, card('5'), NOW);
    game.pullDomainEvents();

    game.removeParticipant(ana, facilitatorId, NOW);

    expect(game.currentRound()?.hasVoted(ana)).toBe(false);
    expect(game.pullDomainEvents().map((event) => event.type)).toEqual([
      'ParticipantLeft',
      'VoteRetracted',
    ]);
  });

  it('conserva el voto de quien sale en una ronda ya revelada', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.castVote(ana, card('5'), NOW);
    game.reveal(facilitatorId, NOW);

    game.removeParticipant(ana, ana, NOW);

    expect(game.currentRound()?.hasVoted(ana)).toBe(true);
    expect(game.currentRound()?.revealedResult().distribution.get('5')).toBe(1);
  });

  it('revela sola la ronda si quien sale era el único que faltaba por votar', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, card('3'), NOW);
    expect(game.currentRound()?.isRevealed()).toBe(false);

    game.removeParticipant(ana, ana, NOW);

    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('no cuenta a quien ha salido para decidir quién reparte', () => {
    const { game, facilitatorId } = createGame();
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.removeParticipant(ana, ana, NOW);

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });
});

describe('auto-revelado con presencia', () => {
  it('revela cuando han votado todos los votantes presentes aunque falte uno desconectado', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    addVoter(game, 'Ana');
    addIssueAndOpenRound(game);

    game.castVote(facilitatorId, card('5'), NOW, [facilitatorId]);

    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('no revela mientras falte por votar alguien presente', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);

    game.castVote(facilitatorId, card('5'), NOW, [facilitatorId, ana]);

    expect(game.currentRound()?.isRevealed()).toBe(false);
  });

  it('cuenta a todos los votantes cuando no se conoce la presencia', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    addVoter(game, 'Ana');
    addIssueAndOpenRound(game);

    game.castVote(facilitatorId, card('5'), NOW);

    expect(game.currentRound()?.isRevealed()).toBe(false);
  });

  it('revela al desconectarse el último presente que faltaba por votar', () => {
    const { game, facilitatorId } = createGame({ autoReveal: true });
    const ana = addVoter(game, 'Ana');
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, card('5'), NOW, [facilitatorId, ana]);

    game.reconcileAutoReveal(NOW, [facilitatorId]);

    expect(game.currentRound()?.isRevealed()).toBe(true);
  });

  it('no revela una ronda sin ningún voto aunque no quede nadie presente', () => {
    const { game } = createGame({ autoReveal: true });
    addIssueAndOpenRound(game);

    game.reconcileAutoReveal(NOW, []);

    expect(game.currentRound()?.isRevealed()).toBe(false);
  });

  it('no revela al cambiar la presencia si el auto-revelado está desactivado', () => {
    const { game, facilitatorId } = createGame({ autoReveal: false });
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, card('5'), NOW);

    game.reconcileAutoReveal(NOW, [facilitatorId]);

    expect(game.currentRound()?.isRevealed()).toBe(false);
  });
});
