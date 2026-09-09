import type { JSX } from 'react';
import { Tooltip } from '../../design-system/index.js';

export interface DeckEditorPanelProps {
  readonly onClose: () => void;
}

const SYSTEM_DECKS = [
  { name: 'Fibonacci', cards: ['0.5', '1', '2', '3', '5', '8', '13', '?', '☕'] },
  { name: 'Tallas', cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'] },
];

/**
 * Solo lectura: la partida no sabe a qué equipo pertenece (deliberadamente, ver ADR 0006 del
 * bloque 7 — nada más lo necesita todavía), así que desde aquí dentro no hay token de equipo con
 * el que editar. El editor funcional vive en la página del equipo (`/t/:slug?k=token`).
 */
export function DeckEditorPanel({ onClose }: DeckEditorPanelProps): JSX.Element {
  return (
    <div
      className="flex h-full w-[420px] max-w-full flex-col"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <span className="text-sm font-semibold">Barajas del equipo</span>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {SYSTEM_DECKS.map((deck) => (
          <div
            key={deck.name}
            className="flex flex-col gap-2 rounded-[10px] p-3"
            style={{ border: '1px solid var(--pp-line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{deck.name}</span>
              <span className="tag tag-neutral">del sistema</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {deck.cards.map((card) => (
                <span
                  key={card}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  style={{ border: '1px solid var(--pp-line)', color: 'var(--pp-muted)' }}
                >
                  <span aria-hidden="true">⠿</span>
                  {card}
                </span>
              ))}
            </div>
          </div>
        ))}

        <Tooltip label="Añade y edita barajas personalizadas desde la página de tu equipo (/t/tu-equipo)">
          <button
            type="button"
            className="flex w-full items-center justify-center rounded-[10px] border border-dashed py-3 text-sm"
            style={{
              borderColor: 'var(--pp-line)',
              color: 'var(--pp-muted)',
              cursor: 'not-allowed',
            }}
            disabled
          >
            + Baraja nueva
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
