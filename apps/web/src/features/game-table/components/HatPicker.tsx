import { HAT_IDS, WINTER_HAT_IDS } from '@pp/contracts';
import type { HatIdView } from '@pp/contracts';
import type { JSX } from 'react';
import { Avatar, Button, HAT_LABELS, Modal } from '../../../design-system/index.js';
import { useSeason } from '../../../shared/season/season.js';
import type { Season } from '../../../shared/season/season.js';

export interface HatPickerProps {
  readonly open: boolean;
  readonly viewerId: string;
  readonly current: HatIdView | null;
  readonly onSelect: (hat: HatIdView | null) => void;
  readonly onClose: () => void;
}

export interface HatOption {
  readonly hat: HatIdView | null;
  readonly label: string;
}

const isWinterHat = (hat: HatIdView): boolean =>
  WINTER_HAT_IDS.some((candidate) => candidate === hat);

/**
 * En invierno los gorros de temporada van primero; fuera de fechas no se ofrecen, salvo el que ya
 * lleva puesto quien abre el selector, para que pueda ver cuál es (ADR 0031).
 */
export function hatOptions(season: Season | null, current: HatIdView | null): HatOption[] {
  const regular = HAT_IDS.filter((hat) => !isWinterHat(hat));
  const winter = HAT_IDS.filter(isWinterHat);
  const hats =
    season === 'winter'
      ? [...winter, ...regular]
      : [...regular, ...winter.filter((hat) => hat === current)];
  return [
    { hat: null, label: 'Sin sombrero' },
    ...hats.map((hat) => ({ hat, label: HAT_LABELS[hat] })),
  ];
}

/**
 * Se aplica al pulsar, sin botón de guardar, y el diálogo sigue abierto para probarse otro: la
 * mesa entera ve el cambio en vivo, igual que con la baraja (ADR 0014).
 */
export function HatPicker(props: HatPickerProps): JSX.Element | null {
  const options = hatOptions(useSeason(), props.current);
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
        {options.map((option) => {
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
