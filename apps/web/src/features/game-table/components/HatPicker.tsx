import { HAT_IDS } from '@pp/contracts';
import type { HatIdView } from '@pp/contracts';
import type { JSX } from 'react';
import { Avatar, Button, HAT_LABELS, Modal } from '../../../design-system/index.js';

export interface HatPickerProps {
  readonly open: boolean;
  readonly viewerId: string;
  readonly current: HatIdView | null;
  readonly onSelect: (hat: HatIdView | null) => void;
  readonly onClose: () => void;
}

const OPTIONS: ReadonlyArray<{ readonly hat: HatIdView | null; readonly label: string }> = [
  { hat: null, label: 'Sin sombrero' },
  ...HAT_IDS.map((hat) => ({ hat, label: HAT_LABELS[hat] })),
];

/**
 * Se aplica al pulsar, sin botón de guardar, y el diálogo sigue abierto para probarse otro: la
 * mesa entera ve el cambio en vivo, igual que con la baraja (ADR 0014).
 */
export function HatPicker(props: HatPickerProps): JSX.Element | null {
  return (
    <Modal
      open={props.open}
      title="Elige tu sombrero"
      onClose={props.onClose}
      actions={
        <Button variant="primary" onClick={props.onClose}>
          Listo
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup">
        {OPTIONS.map((option) => {
          const selected = option.hat === props.current;
          return (
            <button
              key={option.hat ?? 'none'}
              type="button"
              role="radio"
              aria-checked={selected}
              className="flex flex-col items-center gap-2 rounded-xl px-2 pb-2 pt-5 text-[11px]"
              style={{
                background: selected ? 'rgba(145,132,217,.18)' : 'transparent',
                boxShadow: selected
                  ? 'inset 0 0 0 1.5px var(--color-accent)'
                  : 'inset 0 0 0 1px var(--pp-line)',
                color: 'var(--color-text)',
              }}
              onClick={() => {
                if (!selected) props.onSelect(option.hat);
              }}
            >
              <Avatar seed={props.viewerId} size={36} hat={option.hat} />
              {option.label}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
