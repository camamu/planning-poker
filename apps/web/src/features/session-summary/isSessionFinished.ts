import type { IssueView } from '@pp/contracts';

/**
 * Sin tareas pendientes y con la última votada ya estimada: es el momento de ofrecer el resumen.
 * Una tarea que se dejó a medias (revelada pero sin estimar) no cuenta como pendiente, pero
 * tampoco como terminada si es la última que se votó.
 */
export function isSessionFinished(
  issues: ReadonlyArray<Pick<IssueView, 'id' | 'status'>>,
  currentIssueId: string | null,
): boolean {
  if (currentIssueId === null) return false;
  if (issues.some((issue) => issue.status === 'PENDING')) return false;
  return issues.find((issue) => issue.id === currentIssueId)?.status === 'ESTIMATED';
}
