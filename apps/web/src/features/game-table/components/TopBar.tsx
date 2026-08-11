import { useState } from 'react';
import type { JSX } from 'react';
import { Avatar } from '../../../design-system/index.js';
import { formatCountdown } from '../hooks/useCountdown.js';

export interface TopBarProps {
  readonly gameName: string;
  readonly meta: string;
  readonly remainingMs: number | null;
  readonly muted: boolean;
  readonly onToggleMuted: () => void;
  readonly viewerId: string;
  readonly onToggleIssues: () => void;
}

export function TopBar(props: TopBarProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <nav
      className="flex h-[58px] flex-none items-center gap-4 px-5"
      style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-[30px] w-[22px] items-center justify-center rounded text-[11px] font-bold"
          style={{
            border: '1.5px solid var(--color-accent)',
            color: 'var(--color-accent)',
            transform: 'rotate(-8deg)',
          }}
        >
          8
        </div>
        <span className="text-sm font-semibold">{props.gameName}</span>
      </div>
      <span
        className="text-xs"
        style={{
          color: 'var(--pp-muted)',
          borderLeft: '1px solid var(--color-divider)',
          paddingLeft: 16,
        }}
      >
        {props.meta}
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        {props.remainingMs !== null ? (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ background: 'rgba(145,132,217,.12)', color: 'var(--color-accent)' }}
          >
            ⏱ {formatCountdown(props.remainingMs)}
          </div>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={props.onToggleIssues}>
          📋 Tareas
        </button>
        <button type="button" className="btn btn-secondary" onClick={props.onToggleMuted}>
          {props.muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 2000);
            });
          }}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </button>
        <Avatar seed={props.viewerId} variant="initials" initials="TÚ" size={32} />
      </div>
    </nav>
  );
}
