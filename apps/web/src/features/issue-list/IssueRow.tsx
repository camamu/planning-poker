import { isHttpUrl } from '@pp/contracts';
import type { IssueView } from '@pp/contracts';
import { useRef, useState } from 'react';
import type { DragEvent, JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../design-system/index.js';

/** Solo las tareas por estimar se reordenan: la tarea de la mesa y las estimadas ya tienen su sitio. */
export interface IssueRowReorder {
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly isDragging: boolean;
  readonly isDropTarget: boolean;
  readonly onDragStart: () => void;
  readonly onDragOver: () => void;
  readonly onDrop: () => void;
  readonly onDragEnd: () => void;
}

export interface IssueRowProps {
  readonly issue: IssueView;
  readonly accent?: boolean;
  readonly muted?: boolean;
  readonly onStart?: (() => void) | undefined;
  readonly onRename: (title: string) => void;
  /** Ausente si la tarea ya tiene ronda: solo se borra lo que nunca se ha votado (ADR 0019). */
  readonly onDelete?: (() => void) | undefined;
  readonly reorder?: IssueRowReorder | undefined;
}

export function IssueRow({
  issue,
  accent,
  muted,
  onStart,
  onRename,
  onDelete,
  reorder,
}: IssueRowProps): JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  function submitRename(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = (draft ?? '').trim();
    if (trimmed && trimmed !== issue.title) onRename(trimmed);
    setDraft(null);
  }

  function confirmDelete(): void {
    setMenuOpen(false);
    if (window.confirm(`¿Borrar la tarea «${issue.title}»?`)) onDelete?.();
  }

  function startDrag(event: DragEvent<HTMLSpanElement>): void {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox no arranca un arrastre sin datos.
    event.dataTransfer.setData('text/plain', issue.id);
    if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 16, 16);
    reorder?.onDragStart();
  }

  return (
    <div
      ref={rowRef}
      className="flex flex-col"
      onDragOver={
        reorder
          ? (event) => {
              event.preventDefault();
              reorder.onDragOver();
            }
          : undefined
      }
      onDrop={
        reorder
          ? (event) => {
              event.preventDefault();
              reorder.onDrop();
            }
          : undefined
      }
    >
      <div
        className="flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-left text-sm"
        style={{
          background: 'var(--color-bg)',
          border: accent ? '1px solid var(--color-accent)' : '1px solid transparent',
          borderTop: reorder?.isDropTarget ? '2px solid var(--color-accent)' : undefined,
          opacity: reorder?.isDragging ? 0.4 : muted ? 0.72 : 1,
        }}
      >
        {reorder ? (
          <span
            draggable
            className="cursor-grab select-none px-1 text-xs"
            style={{ color: 'var(--pp-muted)' }}
            aria-hidden="true"
            onDragStart={startDrag}
            onDragEnd={reorder.onDragEnd}
          >
            ⋮⋮
          </span>
        ) : null}

        {editing ? (
          <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={submitRename}>
            <div className="min-w-0 flex-1">
              <Input
                aria-label="Título de la tarea"
                autoFocus
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setDraft(null);
                }}
              />
            </div>
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </form>
        ) : onStart ? (
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer truncate px-1 text-left"
            title={issue.title}
            onClick={onStart}
          >
            {issue.title}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate px-1" title={issue.title}>
            {issue.title}
          </span>
        )}

        {!editing && issue.externalUrl !== null && isHttpUrl(issue.externalUrl) ? (
          <a
            href={issue.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            title={issue.externalUrl}
            aria-label={`Abrir «${issue.title}» en una pestaña nueva`}
          >
            ↗
          </a>
        ) : null}

        {issue.finalEstimate !== null ? (
          <span
            className="flex h-[30px] w-[38px] flex-none items-center justify-center rounded-md font-mono text-xs font-semibold"
            style={{ border: '1px solid var(--pp-line)' }}
          >
            {issue.finalEstimate}
          </span>
        ) : null}

        {!editing && reorder ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Subir «${issue.title}»`}
              disabled={!reorder.canMoveUp}
              onClick={reorder.onMoveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Bajar «${issue.title}»`}
              disabled={!reorder.canMoveDown}
              onClick={reorder.onMoveDown}
            >
              ↓
            </button>
          </>
        ) : null}

        {!editing ? (
          <button
            type="button"
            className="btn btn-ghost"
            aria-label={`Más acciones de «${issue.title}»`}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
          >
            ⋯
          </button>
        ) : null}
      </div>

      {menuOpen && !editing ? (
        <div className="flex gap-1 px-3 pb-1 pt-1.5">
          <Button
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setDraft(issue.title);
            }}
          >
            Editar
          </Button>
          {onDelete ? (
            <Button variant="secondary" onClick={confirmDelete}>
              Borrar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
