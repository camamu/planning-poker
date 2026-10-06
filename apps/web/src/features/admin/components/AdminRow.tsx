import type { JSX, ReactNode } from 'react';

export interface AdminRowProps {
  readonly title: ReactNode;
  readonly tag?: ReactNode;
  readonly meta?: ReactNode;
  readonly children?: ReactNode;
  readonly actions: ReactNode;
}

export function AdminRow({ title, tag, meta, children, actions }: AdminRowProps): JSX.Element {
  return (
    <li
      className="flex flex-col gap-2 rounded-[10px] p-3"
      style={{ border: '1px solid var(--pp-line)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium break-all">{title}</span>
        {tag}
      </div>
      {meta ? (
        <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          {meta}
        </p>
      ) : null}
      {children}
      <div className="flex flex-wrap gap-2">{actions}</div>
    </li>
  );
}

export function AdminListState({
  error,
  loading,
  empty,
  emptyMessage,
}: {
  readonly error: string | null;
  readonly loading: boolean;
  readonly empty: boolean;
  readonly emptyMessage: string;
}): JSX.Element | null {
  if (error) {
    return (
      <p role="alert" style={{ color: '#e5484d' }}>
        {error}
      </p>
    );
  }
  if (loading) return <p className="text-sm">Cargando…</p>;
  if (empty) {
    return (
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        {emptyMessage}
      </p>
    );
  }
  return null;
}
