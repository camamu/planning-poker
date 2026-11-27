import type { JSX } from 'react';
import { Button, Modal } from '../../../design-system/index.js';

export interface SeatActionsDialogProps {
  /** A quién se le aplican; `null` = cerrado. */
  readonly participant: { readonly id: string; readonly displayName: string } | null;
  readonly onMakeFacilitator: (participantId: string) => void;
  readonly onRemove: (participantId: string) => void;
  readonly onClose: () => void;
}

/**
 * Lo que el facilitador puede hacer con otra persona, en el móvil (ADR 0032): sustituye a los
 * botones 🔑 y ✕ de cada asiento, que allí no llegan al mínimo táctil. Elegir aquí ya es la
 * confirmación, sin otro `window.confirm` encima.
 */
export function SeatActionsDialog({
  participant,
  onMakeFacilitator,
  onRemove,
  onClose,
}: SeatActionsDialogProps): JSX.Element {
  return (
    <Modal
      open={participant !== null}
      title={participant?.displayName ?? ''}
      onClose={onClose}
      actions={
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      {participant ? (
        <div className="flex flex-col gap-2.5">
          <Button
            variant="secondary"
            block
            className="min-h-12"
            onClick={() => {
              onMakeFacilitator(participant.id);
            }}
          >
            🔑 Hacer facilitador
          </Button>
          <span className="-mt-1 text-xs" style={{ color: 'var(--pp-muted)' }}>
            Dejarás de serlo: los ajustes y el revelado pasan a {participant.displayName}.
          </span>
          <Button
            variant="secondary"
            block
            className="min-h-12"
            onClick={() => {
              onRemove(participant.id);
            }}
          >
            ✕ Quitar de la partida
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
