import type { AsyncRoundView, IssueView } from '@pp/contracts';

export interface AsyncEntry {
  readonly issue: IssueView;
  readonly round: AsyncRoundView;
}

export interface AsyncQueue {
  /** Rondas abiertas: se puede votar. */
  readonly open: ReadonlyArray<AsyncEntry>;
  /** Reveladas y a la espera de que alguien acepte una estimación. */
  readonly revealed: ReadonlyArray<AsyncEntry>;
}

/**
 * Separa las rondas en diferido por estado, en el orden en que se abrieron. Una ronda cuya tarea ya
 * no está en la cola (borrada entre dos sincronizaciones) se descarta en vez de pintarse sin título.
 */
export function asyncQueue(
  issues: ReadonlyArray<IssueView>,
  rounds: ReadonlyArray<AsyncRoundView>,
): AsyncQueue {
  const entries = rounds.flatMap((round) => {
    const issue = issues.find((candidate) => candidate.id === round.issueId);
    return issue ? [{ issue, round }] : [];
  });
  return {
    open: entries.filter(({ round }) => round.status === 'OPEN'),
    revealed: entries.filter(({ round }) => round.status === 'REVEALED'),
  };
}

/** Las tareas con una ronda en diferido viva dejan de ser «por estimar» en la cola. */
export function asyncIssueIds(rounds: ReadonlyArray<AsyncRoundView>): ReadonlySet<string> {
  return new Set(rounds.map((round) => round.issueId));
}

/** Cuántos de los votantes actuales han votado; quien votó y ya no está (o es espectador) no cuenta. */
export function votedCount(round: AsyncRoundView, voterIds: ReadonlyArray<string>): number {
  return round.voterIds.filter((id) => voterIds.includes(id)).length;
}

/** Rondas abiertas en las que el viewer todavía no ha votado: lo que le queda por hacer. */
export function pendingVoteCount(queue: AsyncQueue, viewerId: string): number {
  return queue.open.filter(({ round }) => !round.voterIds.includes(viewerId)).length;
}

/** Una ronda sin votos no tiene resultado que enseñar y el servidor la deja abierta. */
export function revealableIssueIds(queue: AsyncQueue): string[] {
  return queue.open.filter(({ round }) => round.voterIds.length > 0).map(({ issue }) => issue.id);
}

/**
 * La tarea que «Siguiente tarea» lleva a la mesa: la primera por estimar de la cola. Las que tienen
 * una ronda en diferido viva siguen `PENDING` en el dominio, pero se gestionan en su sección; saltar
 * a una cuyo resultado espera aceptación la dejaría sin cerrar. Para llevar una a la mesa está
 * «Votar en vivo».
 */
export function nextTableIssueId(
  issues: ReadonlyArray<IssueView>,
  rounds: ReadonlyArray<AsyncRoundView>,
): string | null {
  const inAsync = asyncIssueIds(rounds);
  return issues.find((issue) => issue.status === 'PENDING' && !inAsync.has(issue.id))?.id ?? null;
}
