import { describe, expect, it } from 'vitest';
import {
  asyncIssueIds,
  asyncQueue,
  nextTableIssueId,
  pendingVoteCount,
  revealableIssueIds,
  votedCount,
} from './asyncQueue.js';
import { asyncRoundView, issueView } from './asyncVotingFixtures.js';

describe('asyncQueue', () => {
  it('separa las rondas abiertas de las reveladas conservando el orden en que se abrieron', () => {
    const issues = [issueView('a'), issueView('b'), issueView('c')];
    const rounds = [
      asyncRoundView('c'),
      asyncRoundView('a', { status: 'REVEALED' }),
      asyncRoundView('b'),
    ];

    const queue = asyncQueue(issues, rounds);

    expect(queue.open.map(({ issue }) => issue.id)).toEqual(['c', 'b']);
    expect(queue.revealed.map(({ issue }) => issue.id)).toEqual(['a']);
  });

  it('descarta la ronda de una tarea que ya no está en la cola', () => {
    const queue = asyncQueue([issueView('a')], [asyncRoundView('a'), asyncRoundView('borrada')]);

    expect(queue.open.map(({ issue }) => issue.id)).toEqual(['a']);
  });

  it('lista las tareas con ronda en diferido para sacarlas de «por estimar»', () => {
    const ids = asyncIssueIds([asyncRoundView('a'), asyncRoundView('b', { status: 'REVEALED' })]);

    expect([...ids]).toEqual(['a', 'b']);
  });
});

describe('votedCount', () => {
  it('cuenta solo a los votantes actuales: quien votó y ya no vota no hace falta', () => {
    const round = asyncRoundView('a', { voterIds: ['p1', 'p2', 'ya-no-esta'] });

    expect(votedCount(round, ['p1', 'p2', 'p3'])).toBe(2);
  });
});

describe('pendingVoteCount', () => {
  it('cuenta las rondas abiertas en las que el viewer aún no ha votado', () => {
    const issues = [issueView('a'), issueView('b'), issueView('c')];
    const queue = asyncQueue(issues, [
      asyncRoundView('a', { voterIds: ['p1'] }),
      asyncRoundView('b', { voterIds: ['p2'] }),
      asyncRoundView('c', { status: 'REVEALED', voterIds: [] }),
    ]);

    expect(pendingVoteCount(queue, 'p1')).toBe(1);
    expect(pendingVoteCount(queue, 'p3')).toBe(2);
  });
});

describe('revealableIssueIds', () => {
  it('solo ofrece revelar las rondas abiertas que tienen algún voto', () => {
    const queue = asyncQueue(
      [issueView('a'), issueView('b')],
      [asyncRoundView('a', { voterIds: ['p1'] }), asyncRoundView('b')],
    );

    expect(revealableIssueIds(queue)).toEqual(['a']);
  });
});

describe('nextTableIssueId', () => {
  it('es la primera tarea por estimar de la cola', () => {
    const issues = [issueView('est', { status: 'ESTIMATED' }), issueView('a'), issueView('b')];

    expect(nextTableIssueId(issues, [])).toBe('a');
  });

  it('salta las tareas que tienen una ronda en diferido, abierta o revelada', () => {
    const issues = [issueView('a'), issueView('b'), issueView('c')];
    const rounds = [asyncRoundView('a'), asyncRoundView('b', { status: 'REVEALED' })];

    expect(nextTableIssueId(issues, rounds)).toBe('c');
  });

  it('es nula cuando todo lo pendiente está en diferido', () => {
    expect(nextTableIssueId([issueView('a')], [asyncRoundView('a')])).toBeNull();
  });
});
