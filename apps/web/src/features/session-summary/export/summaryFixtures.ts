import type { GameSummaryIssueView, GameSummaryView } from '@pp/contracts';

export function summaryIssue(overrides: Partial<GameSummaryIssueView> = {}): GameSummaryIssueView {
  return {
    id: 'issue-1',
    title: 'Login',
    description: null,
    externalUrl: null,
    status: 'ESTIMATED',
    finalEstimate: '5',
    rounds: 1,
    agreementPercentage: 100,
    average: 5,
    durationMs: 180_000,
    ...overrides,
  };
}

export function gameSummary(overrides: Partial<GameSummaryView> = {}): GameSummaryView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    issues: [summaryIssue()],
    totals: {
      estimatedCount: 1,
      pendingCount: 0,
      points: 5,
      nonNumericEstimates: {},
      unanimousCount: 1,
      multiRoundCount: 0,
      averageDurationMs: 180_000,
      voterCount: 3,
    },
    ...overrides,
  };
}
