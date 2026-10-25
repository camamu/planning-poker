import type { IssueView } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { moveItem, queueWithPendingOrder } from './issueOrder.js';

const issue = (id: string, status: IssueView['status']): IssueView => ({
  id,
  title: id,
  status,
  finalEstimate: null,
});

describe('moveItem', () => {
  it('mueve un elemento a otra posición sin tocar el original', () => {
    const original = ['a', 'b', 'c', 'd'];
    expect(moveItem(original, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(original, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(original).toEqual(['a', 'b', 'c', 'd']);
  });

  it('un índice de origen fuera de rango no cambia nada', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('queueWithPendingOrder', () => {
  const queue = [
    issue('est', 'ESTIMATED'),
    issue('p1', 'PENDING'),
    issue('mesa', 'VOTING'),
    issue('p2', 'PENDING'),
    issue('p3', 'PENDING'),
  ];

  it('reparte las tareas por estimar en sus huecos y deja quietas las demás', () => {
    expect(queueWithPendingOrder(queue, ['p3', 'p1', 'p2'])).toEqual([
      'est',
      'p3',
      'mesa',
      'p1',
      'p2',
    ]);
  });

  it('con el mismo orden devuelve la cola tal cual', () => {
    expect(queueWithPendingOrder(queue, ['p1', 'p2', 'p3'])).toEqual([
      'est',
      'p1',
      'mesa',
      'p2',
      'p3',
    ]);
  });

  it('siempre devuelve tantas tareas como tiene la cola', () => {
    expect(queueWithPendingOrder(queue, ['p2', 'p3', 'p1'])).toHaveLength(queue.length);
  });
});
