import type { AsyncRoundView } from '@pp/contracts';

/** Fábrica de vistas para los tests; vive en `shared` porque `shared` no puede importar de `features`. */
export function asyncRoundView(
  issueId: string,
  overrides: Partial<AsyncRoundView> = {},
): AsyncRoundView {
  return {
    roundId: `round-${issueId}`,
    issueId,
    status: 'OPEN',
    voterIds: [],
    ownCard: null,
    votes: [],
    result: null,
    ...overrides,
  };
}
