import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import {
  InvalidIssueOrderError,
  IssueHasRoundsError,
  IssueNotFoundError,
  ParticipantNotFoundError,
} from '../../src/domain/game/Game.js';
import { InvalidIssueTitleError } from '../../src/domain/game/Issue.js';
import { IssueId, RoundId } from '../../src/domain/game/ids.js';
import { NOW, addIssueAndOpenRound, addVoter, createGame, nextId } from './support/gameFixtures.js';

function addIssue(game: ReturnType<typeof createGame>['game'], title: string): IssueId {
  const id = IssueId.of(nextId('issue'));
  game.addIssue(id, title, NOW);
  return id;
}

function titles(game: ReturnType<typeof createGame>['game']): string[] {
  return game.allIssues().map((issue) => issue.title);
}

describe('edición de tareas', () => {
  it('permite renombrar una tarea', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game, 'Implementar logn');
    game.pullDomainEvents();

    game.editIssue(issueId, { title: '  Implementar login  ' }, facilitatorId, NOW);

    expect(game.findIssue(issueId)?.title).toBe('Implementar login');
    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['IssueEdited']);
  });

  it('no permite dejar una tarea sin título', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game, 'Implementar login');
    game.pullDomainEvents();

    expect(() => {
      game.editIssue(issueId, { title: '   ' }, facilitatorId, NOW);
    }).toThrow(InvalidIssueTitleError);
    expect(game.findIssue(issueId)?.title).toBe('Implementar login');
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('conserva la descripción y el enlace de una tarea si al editarla no se envían', () => {
    const { game, facilitatorId } = createGame();
    const issueId = addIssue(game, 'Implementar login');
    game.editIssue(
      issueId,
      { title: 'Implementar login', description: 'Con OAuth', externalUrl: 'https://t/1' },
      facilitatorId,
      NOW,
    );

    game.editIssue(issueId, { title: 'Implementar el login' }, facilitatorId, NOW);

    const issue = game.findIssue(issueId);
    expect(issue?.title).toBe('Implementar el login');
    expect(issue?.description).toBe('Con OAuth');
    expect(issue?.externalUrl).toBe('https://t/1');
  });

  it('permite corregir una tarea que ya se ha votado', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);

    game.editIssue(issueId, { title: 'Implementar login con SSO' }, facilitatorId, NOW);

    expect(game.findIssue(issueId)?.title).toBe('Implementar login con SSO');
    expect(game.findIssue(issueId)?.currentStatus()).toBe('VOTING');
  });

  it('permite que cualquier participante edite tareas, también un espectador', () => {
    const { game } = createGame();
    const issueId = addIssue(game, 'Implementar logn');
    const spectatorId = addVoter(game, 'Mirón');
    game.changeParticipantRole(spectatorId, 'SPECTATOR', NOW);

    game.editIssue(issueId, { title: 'Implementar login' }, spectatorId, NOW);

    expect(game.findIssue(issueId)?.title).toBe('Implementar login');
  });

  it('quien ha salido no puede editar tareas', () => {
    const { game } = createGame();
    const issueId = addIssue(game, 'Implementar login');
    const ana = addVoter(game, 'Ana');
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.editIssue(issueId, { title: 'Otro título' }, ana, NOW);
    }).toThrow(ParticipantNotFoundError);
  });

  it('no permite editar una tarea que no existe en la partida', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.editIssue(IssueId.of('inexistente'), { title: 'Algo' }, facilitatorId, NOW);
    }).toThrow(IssueNotFoundError);
  });
});

describe('borrado de tareas', () => {
  it('permite borrar una tarea que nunca se ha votado', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game, 'Primera');
    addIssue(game, 'Segunda');
    game.pullDomainEvents();

    game.removeIssue(first, facilitatorId, NOW);

    expect(titles(game)).toEqual(['Segunda']);
    expect(game.pullDomainEvents().map((event) => event.type)).toEqual(['IssueRemoved']);
  });

  it('no permite borrar una tarea que ya se ha votado', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.castVote(facilitatorId, CardValue.of('5'), NOW);
    game.reveal(facilitatorId, NOW);
    game.setFinalEstimate(CardValue.of('5'), facilitatorId, NOW);
    game.pullDomainEvents();

    expect(() => {
      game.removeIssue(issueId, facilitatorId, NOW);
    }).toThrow(IssueHasRoundsError);
    expect(game.findIssue(issueId)).toBeDefined();
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('no permite borrar la tarea de la ronda abierta', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);

    expect(() => {
      game.removeIssue(issueId, facilitatorId, NOW);
    }).toThrow(IssueHasRoundsError);
  });

  it('no permite borrar una tarea cuya ronda se ha vuelto a votar', () => {
    const { game, facilitatorId } = createGame();
    const { issueId } = addIssueAndOpenRound(game);
    game.reveal(facilitatorId, NOW);
    // Misma tarea, ronda 2: "Volver a votar".
    game.startVotingRound(RoundId.of(nextId('round')), issueId, NOW);

    expect(() => {
      game.removeIssue(issueId, facilitatorId, NOW);
    }).toThrow(IssueHasRoundsError);
  });

  it('no permite borrar una tarea que no existe en la partida', () => {
    const { game, facilitatorId } = createGame();

    expect(() => {
      game.removeIssue(IssueId.of('inexistente'), facilitatorId, NOW);
    }).toThrow(IssueNotFoundError);
  });

  it('quien ha salido no puede borrar tareas', () => {
    const { game } = createGame();
    const issueId = addIssue(game, 'Implementar login');
    const ana = addVoter(game, 'Ana');
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.removeIssue(issueId, ana, NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(titles(game)).toEqual(['Implementar login']);
  });

  it('recalcula el dealer con la posición de la tarea actual al borrar una anterior', () => {
    const { game, facilitatorId } = createGame();
    const bea = addVoter(game, 'Bea');
    const before = addIssue(game, 'Anterior');
    const current = addIssue(game, 'Actual');
    game.startVotingRound(RoundId.of(nextId('round')), current, NOW);
    expect(game.currentDealer()?.equals(bea)).toBe(true);

    game.removeIssue(before, facilitatorId, NOW);

    expect(game.currentDealer()?.equals(facilitatorId)).toBe(true);
  });
});

describe('orden de la cola de tareas', () => {
  it('permite reordenar las tareas', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game, 'Primera');
    const second = addIssue(game, 'Segunda');
    const third = addIssue(game, 'Tercera');
    game.pullDomainEvents();

    game.reorderIssues([third, first, second], facilitatorId, NOW);

    expect(titles(game)).toEqual(['Tercera', 'Primera', 'Segunda']);
    const events = game.pullDomainEvents();
    expect(events.map((event) => event.type)).toEqual(['IssuesReordered']);
  });

  it('no acepta un orden que no contiene exactamente las tareas de la partida', () => {
    const { game, facilitatorId } = createGame();
    const first = addIssue(game, 'Primera');
    const second = addIssue(game, 'Segunda');
    game.pullDomainEvents();

    expect(() => {
      game.reorderIssues([second], facilitatorId, NOW);
    }).toThrow(InvalidIssueOrderError);
    expect(() => {
      game.reorderIssues([second, first, IssueId.of('ajena')], facilitatorId, NOW);
    }).toThrow(InvalidIssueOrderError);
    expect(() => {
      game.reorderIssues([second, second], facilitatorId, NOW);
    }).toThrow(InvalidIssueOrderError);
    expect(() => {
      game.reorderIssues([second, IssueId.of('ajena')], facilitatorId, NOW);
    }).toThrow(InvalidIssueOrderError);

    expect(titles(game)).toEqual(['Primera', 'Segunda']);
    expect(game.pullDomainEvents()).toEqual([]);
  });

  it('quien ha salido no puede reordenar tareas', () => {
    const { game } = createGame();
    const first = addIssue(game, 'Primera');
    const second = addIssue(game, 'Segunda');
    const ana = addVoter(game, 'Ana');
    game.removeParticipant(ana, ana, NOW);

    expect(() => {
      game.reorderIssues([second, first], ana, NOW);
    }).toThrow(ParticipantNotFoundError);
    expect(titles(game)).toEqual(['Primera', 'Segunda']);
  });

  it('permite reordenar con una ronda abierta, incluida la tarea que se está votando', () => {
    const { game, facilitatorId } = createGame();
    const { issueId: current } = addIssueAndOpenRound(game);
    const next = addIssue(game, 'Siguiente');

    game.reorderIssues([next, current], facilitatorId, NOW);

    expect(game.allIssues().map((issue) => issue.id.value)).toEqual([next.value, current.value]);
    expect(game.currentRound()?.issueId.equals(current)).toBe(true);
  });
});
