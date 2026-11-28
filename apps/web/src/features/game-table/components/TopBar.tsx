import type { HatIdView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Avatar, Emoji, Logo } from '../../../design-system/index.js';
import { formatCountdown } from '../hooks/useCountdown.js';
import { HatPicker } from './HatPicker.js';
import { InviteDialog } from './InviteDialog.js';

export interface TopBarProps {
  readonly gameName: string;
  readonly meta: string;
  readonly remainingMs: number | null;
  readonly muted: boolean;
  readonly onToggleMuted: () => void;
  /** Solo en temporada y con la nieve de la sala activada: cada uno puede quitársela (ADR 0031). */
  readonly snow?: { readonly off: boolean; readonly onToggle: () => void } | undefined;
  readonly viewerId: string;
  readonly viewerHat: HatIdView | null;
  readonly onChangeHat: (hat: HatIdView | null) => void | Promise<void>;
  /** Se abre en otra pestaña: salir de la sala desconectaría el socket y el resto te vería ausente. */
  readonly summaryHref: string;
  readonly onToggleIssues: () => void;
  /** Tareas en diferido que le quedan por votar al viewer; 0 = nada que avisar. */
  readonly asyncToVote: number;
  readonly onToggleSettings: () => void;
  /** El facilitador también sale, pero antes cede el rol (ADR 0021): lo resuelve quien lo pasa. */
  readonly onLeave?: (() => void) | undefined;
  /**
   * Móvil en vertical (docs/06-handoff-diseno.md §8): logo, nombre, mute y ☰. El resto de botones
   * no cabe en 390 px y va dentro del menú.
   */
  readonly compact?: boolean | undefined;
}

export function TopBar(props: TopBarProps): JSX.Element {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [hatPickerOpen, setHatPickerOpen] = useState(false);

  const dialogs = (
    <>
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
    </>
  );

  if (props.compact) {
    return (
      <CompactTopBar
        {...props}
        onOpenHatPicker={() => {
          setHatPickerOpen(true);
        }}
        onOpenInvite={() => {
          setInviteOpen(true);
        }}
      >
        {dialogs}
      </CompactTopBar>
    );
  }

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
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
        {props.remainingMs !== null ? <Countdown remainingMs={props.remainingMs} /> : null}
        <button type="button" className="btn btn-secondary" onClick={props.onToggleIssues}>
          <Emoji emoji="📋" /> Tareas
          {props.asyncToVote > 0 ? (
            <span
              className="tag tag-accent ml-1.5"
              aria-label={`${props.asyncToVote.toString()} por votar en diferido`}
            >
              {props.asyncToVote}
            </span>
          ) : null}
        </button>
        <a
          href={props.summaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          <Emoji emoji="📊" /> Resumen
        </a>
        <button type="button" className="btn btn-secondary" onClick={props.onToggleSettings}>
          <Emoji emoji="⚙️" /> Ajustes
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={props.muted ? 'Activar el sonido' : 'Silenciar'}
          onClick={props.onToggleMuted}
        >
          <Emoji emoji={props.muted ? '🔇' : '🔊'} />
        </button>
        {props.snow ? (
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={!props.snow.off}
            aria-label={props.snow.off ? 'Volver a ver la nieve' : 'Quitar la nieve solo para mí'}
            title={props.snow.off ? 'Volver a ver la nieve' : 'Quitar la nieve solo para mí'}
            onClick={props.snow.onToggle}
            style={props.snow.off ? { opacity: 0.45 } : undefined}
          >
            <Emoji emoji="❄️" />
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setHatPickerOpen(true);
          }}
        >
          <Emoji emoji="🎩" /> Sombrero
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setInviteOpen(true);
          }}
        >
          <Emoji emoji="🔗" /> Invitar
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
      {dialogs}
    </nav>
  );
}

function Countdown({ remainingMs }: { readonly remainingMs: number }): JSX.Element {
  return (
    <div
      className="flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
      style={{ background: 'rgba(145,132,217,.12)', color: 'var(--color-accent)' }}
    >
      <Emoji emoji="⏱️" /> {formatCountdown(remainingMs)}
    </div>
  );
}

function CompactTopBar(
  props: TopBarProps & {
    readonly onOpenHatPicker: () => void;
    readonly onOpenInvite: () => void;
    readonly children: ReactNode;
  },
): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  /** Cada opción del menú lo cierra antes de hacer lo suyo: los paneles y diálogos se abren encima. */
  function choose(action: () => void): () => void {
    return () => {
      setMenuOpen(false);
      action();
    };
  }

  const snowLabel = props.snow?.off ? 'Volver a ver la nieve' : 'Quitar la nieve solo para mí';

  return (
    <nav
      className="relative flex min-h-[52px] flex-none items-center gap-2.5 py-2 pl-4 pr-3"
      style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}
    >
      <span className="flex-none">
        <Logo size={28} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold">{props.gameName}</span>
        <span className="truncate text-[10px]" style={{ color: 'var(--pp-muted)' }}>
          {props.meta}
        </span>
      </div>
      {props.remainingMs !== null ? <Countdown remainingMs={props.remainingMs} /> : null}
      <button
        type="button"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-sm"
        style={{ border: '1px solid var(--pp-line)' }}
        aria-label={props.muted ? 'Activar el sonido' : 'Silenciar'}
        onClick={props.onToggleMuted}
      >
        <Emoji emoji={props.muted ? '🔇' : '🔊'} />
      </button>
      <button
        type="button"
        className="relative flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-base"
        style={{
          border: `1px solid ${menuOpen ? 'var(--color-accent)' : 'var(--pp-line)'}`,
          color: menuOpen ? 'var(--color-accent)' : 'var(--pp-muted)',
        }}
        aria-label="Menú de la partida"
        aria-expanded={menuOpen}
        aria-controls="pp-room-menu"
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
      >
        ☰
        {props.asyncToVote > 0 ? (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold"
            style={{ background: 'var(--color-accent)', color: 'var(--pp-on-accent)' }}
            aria-hidden="true"
          >
            {props.asyncToVote}
          </span>
        ) : null}
      </button>

      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => {
              setMenuOpen(false);
            }}
          />
          <div
            id="pp-room-menu"
            className="absolute right-3 top-full z-50 mt-1.5 flex w-60 flex-col rounded-xl p-1.5"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-divider)',
              boxShadow: '0 16px 40px rgba(0,0,0,.45)',
            }}
          >
            <MenuItem onClick={choose(props.onToggleIssues)}>
              <Emoji emoji="📋" /> Tareas
              {props.asyncToVote > 0 ? (
                <span
                  className="tag tag-accent ml-auto"
                  aria-label={`${props.asyncToVote.toString()} por votar en diferido`}
                >
                  {props.asyncToVote}
                </span>
              ) : null}
            </MenuItem>
            <a
              href={props.summaryHref}
              target="_blank"
              rel="noopener noreferrer"
              className={MENU_ITEM_CLASS}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              <Emoji emoji="📊" /> Resumen
            </a>
            <MenuItem onClick={choose(props.onToggleSettings)}>
              <Emoji emoji="⚙️" /> Ajustes
            </MenuItem>
            {props.snow ? (
              <MenuItem onClick={choose(props.snow.onToggle)} pressed={!props.snow.off}>
                <Emoji emoji="❄️" /> {snowLabel}
              </MenuItem>
            ) : null}
            <MenuItem onClick={choose(props.onOpenHatPicker)}>
              <Avatar
                seed={props.viewerId}
                variant="initials"
                initials="TÚ"
                size={22}
                hat={props.viewerHat}
              />
              Sombrero
            </MenuItem>
            <MenuItem onClick={choose(props.onOpenInvite)}>
              <Emoji emoji="🔗" /> Invitar
            </MenuItem>
            {props.onLeave ? (
              <MenuItem onClick={choose(props.onLeave)} accent>
                Salir de la partida
              </MenuItem>
            ) : null}
          </div>
        </>
      ) : null}
      {props.children}
    </nav>
  );
}

/** Filas de 44 px: el mínimo táctil del móvil (docs/06-handoff-diseno.md §8). */
const MENU_ITEM_CLASS =
  'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]';

function MenuItem({
  children,
  onClick,
  pressed,
  accent,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly pressed?: boolean;
  readonly accent?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className={MENU_ITEM_CLASS}
      style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
