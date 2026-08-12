import { describe, expect, it } from 'vitest';
import { computeResultBadges } from './resultBadges.js';

describe('computeResultBadges', () => {
  it('sin dispersión (todos iguales) no reparte insignias', () => {
    const badges = computeResultBadges([
      { participantId: 'p1', card: '5', hasVoted: true },
      { participantId: 'p2', card: '5', hasVoted: true },
    ]);
    expect(badges.feathers.size).toBe(0);
    expect(badges.capes.size).toBe(0);
  });

  it('con dispersión, pluma para el más alto y capa para el más bajo', () => {
    const badges = computeResultBadges([
      { participantId: 'p1', card: '13', hasVoted: true },
      { participantId: 'p2', card: '1', hasVoted: true },
      { participantId: 'p3', card: '5', hasVoted: true },
    ]);
    expect(badges.feathers.has('p1')).toBe(true);
    expect(badges.capes.has('p2')).toBe(true);
    expect(badges.feathers.has('p3')).toBe(false);
  });

  it('ignora las cartas especiales al calcular dispersión', () => {
    const badges = computeResultBadges([
      { participantId: 'p1', card: '5', hasVoted: true },
      { participantId: 'p2', card: '?', hasVoted: true },
    ]);
    expect(badges.feathers.size).toBe(0);
    expect(badges.capes.size).toBe(0);
  });
});
