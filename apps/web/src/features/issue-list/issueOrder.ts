import type { IssueView } from '@pp/contracts';

export function moveItem<T>(items: ReadonlyArray<T>, from: number, to: number): T[] {
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  if (item === undefined) return moved;
  moved.splice(to, 0, item);
  return moved;
}

/**
 * La API pide la cola entera, no solo las tareas que se mueven. Las tareas por estimar ocupan los
 * huecos que ya tenían en la cola, en el orden nuevo; las demás (en la mesa, ya estimadas) no se
 * mueven, así que reordenar no cambia la posición de la tarea actual ni, con ella, el dealer.
 */
export function queueWithPendingOrder(
  issues: ReadonlyArray<IssueView>,
  pendingIds: ReadonlyArray<string>,
): string[] {
  const reordered = new Set(pendingIds);
  const upcoming = [...pendingIds];
  return issues.map((issue) =>
    reordered.has(issue.id) ? (upcoming.shift() ?? issue.id) : issue.id,
  );
}
