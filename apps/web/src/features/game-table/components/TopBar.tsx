import type { HatIdView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX } from 'react';
import { Avatar, Logo } from '../../../design-system/index.js';
import { formatCountdown } from '../hooks/useCountdown.js';
import { HatPicker } from './HatPicker.js';
import { InviteDialog } from './InviteDialog.js';

export interface TopBarProps {
  readonly gameName: string;
  readonly meta: string;
  readonly remainingMs: number | null;
  readonly muted: boolean;
  readonly onToggleMuted: () => void;
  readonly viewerId: string;
  readonly viewerHat: HatIdView | null;
  readonly onChangeHat: (hat: HatIdView | null) => void | Promise<void>;
  readonly onToggleIssues: () => void;
  readonly onToggleSettings?: (() => void) | undefined;
  /** Ausente para el facilitador: no puede salir de su propia partida. */
  readonly onLeave?: (() => void) | undefined;
}

export function TopBar(props: TopBarProps): JSX.Element {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [hatPickerOpen, setHatPickerOpen] = useState(false);

  return (
    <nav
      className="flex min-h-[58px] flex-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2"
      style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex-none">
          <Logo size={32} />
        </span>
        <span className="truncate text-sm font-semibold">{props.gameName}</span>
      </div>
      <span
        className="hidden truncate text-xs sm:block"
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
        {props.onToggleSettings ? (
          <button type="button" className="btn btn-secondary" onClick={props.onToggleSettings}>
            ⚙️ Ajustes
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={props.onToggleMuted}>
          {props.muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setHatPickerOpen(true);
          }}
        >
          🎩 Sombrero
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setInviteOpen(true);
          }}
        >
          🔗 Invitar
        </button>
        {props.onLeave ? (
          <button type="button" className="btn btn-ghost" onClick={props.onLeave}>
            Salir
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-[10px] pt-3"
          aria-label="Cambiar sombrero"
          title="Cambiar sombrero"
          onClick={() => {
            setHatPickerOpen(true);
          }}
        >
          <Avatar
            seed={props.viewerId}
            variant="initials"
            initials="TÚ"
            size={32}
            hat={props.viewerHat}
          />
        </button>
      </div>
      <HatPicker
        open={hatPickerOpen}
        viewerId={props.viewerId}
        current={props.viewerHat}
        onSelect={(hat) => {
          void props.onChangeHat(hat);
        }}
        onClose={() => {
          setHatPickerOpen(false);
        }}
      />
      <InviteDialog
        open={inviteOpen}
        link={window.location.href}
        onClose={() => {
          setInviteOpen(false);
        }}
      />
    </nav>
  );
}
