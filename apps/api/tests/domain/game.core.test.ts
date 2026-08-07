import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { DisplayName } from '../../src/domain/game/DisplayName.js';
import {
  CardNotInDeckError,
  IssueNotFoundError,
  ParticipantAlreadyJoinedError,
  ParticipantNotFoundError,
} from '../../src/domain/game/Game.js';
import { GameSettings } from '../../src/domain/game/GameSettings.js';
import { IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { addIssueAndOpenRound, addVoter, createGame, NOW } from './support/gameFixtures.js';

describe('Game.create', () => {
  it('registra al facilitador como participante y emite GameCreated', () => {
    const { game, facilitatorId } = createGame();

    const events = game.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('GameCreated');
    expect(game.canReveal(facilitatorId)).toBe(true);
  });
});

describe('Game.pullDomainEvents', () => {
  it('vacía la lista de eventos pendientes al leerla', () => {
    const { game } = createGame();
    game.pullDomainEvents();
    expect(game.pullDomainEvents()).toHaveLength(0);
  });
});

describe('Game.addParticipant', () => {
  it('lanza ParticipantAlreadyJoinedError si el id ya está en la partida', () => {
    const { game, facilitatorId } = createGame();
    expect(() => {
      game.addParticipant(facilitatorId, DisplayName.of('Duplicado'), 'VOTER', NOW);
    }).toThrow(ParticipantAlreadyJoinedError);
  });

  it('emite ParticipantJoined', () => {
    const { game } = createGame();
    game.pullDomainEvents();
    addVoter(game);
    const events = game.pullDomainEvents();
    expect(events.some((event) => event.type === 'ParticipantJoined')).toBe(true);
  });
});

describe('Game.changeParticipantRole', () => {
  it('emite ParticipantRoleChanged', () => {
    const { game } = createGame();
    const voterId = addVoter(game);
    game.pullDomainEvents();
    game.changeParticipantRole(voterId, 'SPECTATOR', NOW);
    const events = game.pullDomainEvents();
    expect(events.some((event) => event.type === 'ParticipantRoleChanged')).toBe(true);
  });
});

describe('Game.addIssue / startVotingRound', () => {
  it('emiten IssueAdded y VotingRoundStarted', () => {
    const { game } = createGame();
    game.pullDomainEvents();
    addIssueAndOpenRound(game);
    const events = game.pullDomainEvents();
    expect(events.map((event) => event.type)).toEqual(['IssueAdded', 'VotingRoundStarted']);
  });

  it('lanza IssueNotFoundError al abrir una ronda sobre una issue inexistente', () => {
    const { game } = createGame();
    expect(() => {
      game.startVotingRound(RoundId.of('r1'), IssueId.of('inexistente'), NOW);
    }).toThrow(IssueNotFoundError);
  });
});

describe('Game.castVote — idempotencia', () => {
  it('revotar la misma carta no genera un nuevo VoteCast', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.pullDomainEvents();

    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    expect(game.pullDomainEvents()).toHaveLength(0);
  });
});

describe('Game.setFinalEstimate', () => {
  it('lanza CardNotInDeckError si la estimación elegida no pertenece a la baraja', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);

    expect(() => {
      game.setFinalEstimate(CardValue.of('100'), NOW);
    }).toThrow(CardNotInDeckError);
  });
});

describe('Game.retractVote', () => {
  it('retira el voto y deja hasVoted() en false', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    expect(game.currentRound()?.hasVoted(facilitatorId)).toBe(true);

    game.retractVote(facilitatorId, NOW);
    expect(game.currentRound()?.hasVoted(facilitatorId)).toBe(false);
  });

  it('emite VoteRetracted', () => {
    const { game, facilitatorId } = createGame();
    addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.pullDomainEvents();

    game.retractVote(facilitatorId, NOW);
    const events = game.pullDomainEvents();
    expect(events.some((event) => event.type === 'VoteRetracted')).toBe(true);
  });
});

describe('Game — operaciones sobre un participante desconocido', () => {
  it('lanzan ParticipantNotFoundError', () => {
    const { game } = createGame();
    addIssueAndOpenRound(game);
    const unknownId = ParticipantId.of('fantasma');

    expect(() => {
      game.castVote(unknownId, CardValue.of('5'), NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(() => {
      game.retractVote(unknownId, NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(() => {
      game.changeParticipantRole(unknownId, 'SPECTATOR', NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(() => game.canReveal(unknownId)).toThrow(ParticipantNotFoundError);
  });
});

describe('GameSettings.of', () => {
  it('usa una lista vacía de namedRevealers cuando no se indica', () => {
    const settings = GameSettings.of({ autoReveal: false, whoCanReveal: 'ANYONE' });
    expect(settings.namedRevealers).toEqual([]);
  });
});

describe('Game.currentName', () => {
  it('devuelve el nombre de la partida', () => {
    const { game } = createGame();
    expect(game.currentName().value).toBe('Sprint 42');
  });
});
