import type { IssueView } from '@pp/contracts';
import { vi } from 'vitest';
export { asyncRoundView } from '../../shared/testing/viewFixtures.js';
import type { AsyncVotingProps } from './types.js';

export function issueView(id: string, overrides: Partial<IssueView> = {}): IssueView {
  return {
    id,
    title: `Tarea ${id}`,
    description: null,
    externalUrl: null,
    status: 'PENDING',
    finalEstimate: null,
    ...overrides,
  };
}

export function asyncVotingProps(overrides: Partial<AsyncVotingProps> = {}): AsyncVotingProps {
  return {
    rounds: [],
    viewerId: 'p1',
    viewerCanVote: true,
    participants: [
      { id: 'p1', displayName: 'Ada', role: 'VOTER' },
      { id: 'p2', displayName: 'Grace', role: 'VOTER' },
      { id: 'p3', displayName: 'Linus', role: 'VOTER' },
      { id: 'p4', displayName: 'Mirón', role: 'SPECTATOR' },
    ],
    deckCards: ['1', '2', '3', '5', '8'],
    canChangeVote: true,
    canReveal: true,
    pendingCards: {},
    onOpen: vi.fn(),
    onVote: vi.fn(),
    onReveal: vi.fn(),
    onAcceptEstimate: vi.fn(),
    ...overrides,
  };
}
