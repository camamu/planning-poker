import type { IssueView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../design-system/index.js';

export interface IssueListPanelProps {
  readonly issues: ReadonlyArray<IssueView>;
  readonly currentIssueId: string | null;
  readonly canStartRound: boolean;
  readonly onAddIssue: (title: string) => void;
  readonly onStartRound: (issueId: string) => void;
  readonly onClose: () => void;
}

export function IssueListPanel(props: IssueListPanelProps): JSX.Element {
  const [title, setTitle] = useState('');
  const current = props.issues.find((issue) => issue.id === props.currentIssueId);
  const pending = props.issues.filter(
    (issue) => issue.status === 'PENDING' && issue.id !== props.currentIssueId,
  );
  const estimated = props.issues.filter((issue) => issue.status === 'ESTIMATED');
  const estimatedCount = props.issues.filter((issue) => issue.status === 'ESTIMATED').length;

  function handleAdd(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    props.onAddIssue(trimmed);
    setTitle('');
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
                <IssueRow issue={current} accent />
              </IssueGroup>
            ) : null}
            {pending.length > 0 ? (
              <IssueGroup title="Por estimar">
                {pending.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    onClick={
                      props.canStartRound
                        ? () => {
                            props.onStartRound(issue.id);
                          }
                        : undefined
                    }
                  />
                ))}
              </IssueGroup>
            ) : null}
            {estimated.length > 0 ? (
              <IssueGroup title="Ya estimadas">
                {estimated.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} muted />
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

function IssueRow({
  issue,
  accent,
  muted,
  onClick,
}: {
  readonly issue: IssueView;
  readonly accent?: boolean;
  readonly muted?: boolean;
  readonly onClick?: (() => void) | undefined;
}): JSX.Element {
  const content = (
    <div
      className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm"
      style={{
        background: 'var(--color-bg)',
        border: accent ? '1px solid var(--color-accent)' : '1px solid transparent',
        opacity: muted ? 0.72 : 1,
      }}
    >
      <span className="truncate">{issue.title}</span>
      {issue.finalEstimate !== null ? (
        <span
          className="flex h-[30px] w-[38px] flex-none items-center justify-center rounded-md font-mono text-xs font-semibold"
          style={{ border: '1px solid var(--pp-line)' }}
        >
          {issue.finalEstimate}
        </span>
      ) : null}
    </div>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="cursor-pointer text-left">
      {content}
    </button>
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
