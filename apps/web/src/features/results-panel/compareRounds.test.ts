import type { PastRoundView, RoundVoteView } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import { voteChanges } from './compareRounds.js';

const previous: PastRoundView = {
  id: 'round-1',
  roundNumber: 1,
  votes: [
    { participantId: 'ana', card: '3' },
    { participantId: 'bea', card: '8' },
  ],
  result: {
    distribution: { '3': 1, '8': 1 },
    average: 5.5,
    agreementPercentage: 50,
    mostVoted: '3',
    isUnanimous: false,
  },
};

const vote = (participantId: string, card: string | null): RoundVoteView => ({
  participantId,
  card,
  hasVoted: true,
});

describe('voteChanges', () => {
  it('lista a quien votó una carta distinta que en la ronda anterior', () => {
    expect(voteChanges(previous, [vote('ana', '5'), vote('bea', '8')])).toEqual([
      { participantId: 'ana', from: '3', to: '5' },
    ]);
  });

  it('no lista a quien mantuvo su voto', () => {
    expect(voteChanges(previous, [vote('ana', '3'), vote('bea', '8')])).toEqual([]);
  });

  it('no lista a quien solo votó en una de las dos rondas', () => {
    expect(voteChanges(previous, [vote('ana', '3'), vote('carla', '13')])).toEqual([]);
  });

  it('ignora un voto de la ronda actual cuyo valor no se conoce', () => {
    expect(voteChanges(previous, [vote('ana', null)])).toEqual([]);
  });
});
