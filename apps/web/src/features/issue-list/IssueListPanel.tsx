import type { IssueView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../design-system/index.js';
import { IssueRow } from './IssueRow.js';
import { moveItem, queueWithPendingOrder } from './issueOrder.js';

export interface IssueListPanelProps {
  readonly issues: ReadonlyArray<IssueView>;
  readonly currentIssueId: string | null;
  readonly canStartRound: boolean;
  readonly onAddIssue: (title: string) => void;
  readonly onRenameIssue: (issueId: string, title: string) => void;
  readonly onDeleteIssue: (issueId: string) => void;
  /** Recibe la cola entera en el orden nuevo (la API exige una permutación exacta, ADR 0019). */
  readonly onReorderIssues: (issueIds: ReadonlyArray<string>) => void;
  readonly onStartRound: (issueId: string) => void;
  readonly onClose: () => void;
}

export function IssueListPanel(props: IssueListPanelProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const current = props.issues.find((issue) => issue.id === props.currentIssueId);
  const pending = props.issues.filter(
    (issue) => issue.status === 'PENDING' && issue.id !== props.currentIssueId,
  );
  const estimated = props.issues.filter((issue) => issue.status === 'ESTIMATED');
  const estimatedCount = props.issues.filter((issue) => issue.status === 'ESTIMATED').length;
  const pendingIds = pending.map((issue) => issue.id);

  function handleAdd(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    props.onAddIssue(trimmed);
    setTitle('');
  }

  function reorderPending(nextPendingIds: ReadonlyArray<string>): void {
    props.onReorderIssues(queueWithPendingOrder(props.issues, nextPendingIds));
  }

  function endDrag(): void {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function dropOn(targetId: string): void {
    const from = draggingId === null ? -1 : pendingIds.indexOf(draggingId);
    const to = pendingIds.indexOf(targetId);
    endDrag();
    if (from >= 0 && to >= 0 && from !== to) reorderPending(moveItem(pendingIds, from, to));
  }

  return (
    <div
      className="flex h-full w-[340px] max-w-full flex-col"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <span className="text-sm font-semibold">
          Cola de tareas
          <span className="ml-2 text-xs" style={{ color: 'var(--pp-muted)' }}>
            {estimatedCount.toString()} de {props.issues.length.toString()} estimadas
          </span>
        </span>
        <button type="button" className="btn btn-ghost" onClick={props.onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {props.issues.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {current ? (
              <IssueGroup title="En la mesa">
                <IssueRow
                  issue={current}
                  accent
                  onRename={(next) => {
                    props.onRenameIssue(current.id, next);
                  }}
                />
              </IssueGroup>
            ) : null}
            {pending.length > 0 ? (
              <IssueGroup title="Por estimar">
                {pending.map((issue, index) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    onStart={
                      props.canStartRound
                        ? () => {
                            props.onStartRound(issue.id);
                          }
                        : undefined
                    }
                    onRename={(next) => {
                      props.onRenameIssue(issue.id, next);
                    }}
                    onDelete={() => {
                      props.onDeleteIssue(issue.id);
                    }}
                    reorder={{
                      canMoveUp: index > 0,
                      canMoveDown: index < pending.length - 1,
                      onMoveUp: () => {
                        reorderPending(moveItem(pendingIds, index, index - 1));
                      },
                      onMoveDown: () => {
                        reorderPending(moveItem(pendingIds, index, index + 1));
                      },
                      isDragging: draggingId === issue.id,
                      isDropTarget: draggingId !== null && dropTargetId === issue.id,
                      onDragStart: () => {
                        setDraggingId(issue.id);
                      },
                      onDragOver: () => {
                        if (draggingId !== null) setDropTargetId(issue.id);
                      },
                      onDrop: () => {
                        dropOn(issue.id);
                      },
                      onDragEnd: endDrag,
                    }}
                  />
                ))}
              </IssueGroup>
            ) : null}
            {estimated.length > 0 ? (
              <IssueGroup title="Ya estimadas">
                {estimated.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    muted
                    onRename={(next) => {
                      props.onRenameIssue(issue.id, next);
                    }}
                  />
                ))}
              </IssueGroup>
            ) : null}
          </div>
        )}
      </div>

      <form
        className="flex gap-2 p-3"
        style={{ borderTop: '1px solid var(--color-divider)' }}
        onSubmit={handleAdd}
      >
        <Input
          value={title}
          placeholder="Añadir una tarea…"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <Button type="submit" variant="primary">
          Añadir
        </Button>
      </form>
    </div>
  );
}

function IssueGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: JSX.Element | ReadonlyArray<JSX.Element>;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="pp-kicker">{title}</span>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex gap-1.5" aria-hidden="true">
        <span
          className="h-10 w-8 rounded-md border border-dashed"
          style={{ borderColor: 'var(--pp-line)' }}
        />
        <span
          className="h-10 w-8 rounded-md border border-dashed"
          style={{ borderColor: 'var(--pp-line)' }}
        />
      </div>
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Aquí no hay nada que estimar.
      </p>
    </div>
  );
}
