import type { HatIdView } from '@pp/contracts';
import type { JSX, ReactNode } from 'react';
import { Avatar, Emoji } from '../../../design-system/index.js';

export interface SpectatorChipProps {
  readonly spectator: {
    readonly id: string;
    readonly displayName: string;
    readonly online: boolean;
    readonly hat: HatIdView | null;
    readonly isFacilitator: boolean;
  };
  /** Solo el facilitador, y nunca en su propia ficha: ceder el rol o quitar a este mirón. */
  readonly onMakeFacilitator?: (() => void) | undefined;
  readonly onRemove?: (() => void) | undefined;
  /**
   * En el móvil los botones 🔑 y ✕ no llegan al mínimo táctil: la ficha entera abre las acciones
   * (ADR 0032). Sustituye a `onMakeFacilitator` y `onRemove`.
   */
  readonly onOpenActions?: (() => void) | undefined;
}

/** Ficha punteada de quien mira desde la barrera. */
export function SpectatorChip({
  spectator,
  onMakeFacilitator,
  onRemove,
  onOpenActions,
}: SpectatorChipProps): JSX.Element {
  const content: ReactNode = (
    <>
      <Avatar seed={spectator.id} size={20} opacity={0.85} hat={spectator.hat} />
      <span className="text-[11px]" style={{ color: 'var(--pp-muted)' }}>
        {spectator.displayName}
      </span>
      {spectator.isFacilitator ? (
        <span className="text-[11px]" role="img" aria-label="Facilitador" title="Facilitador">
          <Emoji emoji="👑" />
        </span>
      ) : null}
    </>
  );
  const style = { border: '1px dashed var(--pp-line)', opacity: spectator.online ? 1 : 0.45 };
  const title = spectator.online ? undefined : `${spectator.displayName} está desconectado`;

  if (onOpenActions) {
    return (
      <button
        type="button"
        className="flex min-h-9 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
        style={style}
        title={title}
        aria-haspopup="dialog"
        onClick={onOpenActions}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
      style={style}
      title={title}
    >
      {content}
      {onMakeFacilitator ? (
        <button
          type="button"
          className="text-[10px]"
          aria-label={`Hacer facilitador a ${spectator.displayName}`}
          title={`Hacer facilitador a ${spectator.displayName}`}
          onClick={onMakeFacilitator}
        >
          <Emoji emoji="🔑" />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className="text-[10px]"
          style={{ color: 'var(--pp-muted)' }}
          aria-label={`Quitar a ${spectator.displayName}`}
          onClick={onRemove}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
