import type { ParticipantView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button, Modal } from '../../../design-system/index.js';

export interface LeaveFacilitatorDialogProps {
  readonly open: boolean;
  /** Todos los demás participantes de la partida: a cualquiera de ellos se le puede ceder el rol. */
  readonly candidates: ReadonlyArray<ParticipantView>;
  readonly onConfirm: (successorId: string) => void;
  readonly onClose: () => void;
}

/**
 * El facilitador no puede salir sin dejar a alguien en su lugar (`FacilitatorCannotLeaveError`):
 * el diálogo cede el rol y sale en un solo gesto, para que el dominio no tenga que elegir sucesor.
 */
export function LeaveFacilitatorDialog({
  open,
  candidates,
  onConfirm,
  onClose,
}: LeaveFacilitatorDialogProps): JSX.Element | null {
  const [picked, setPicked] = useState<string | null>(null);
  // Quien se va mientras el diálogo está abierto deja de ser una opción válida.
  const selected = candidates.some((candidate) => candidate.id === picked) ? picked : null;
  // Online primero: lo normal es ceder a alguien que está presente para recoger el testigo.
  const ordered = [...candidates].sort((a, b) => Number(b.online) - Number(a.online));

  function close(): void {
    setPicked(null);
    onClose();
  }

  if (candidates.length === 0) {
    return (
      <Modal
        open={open}
        title="Salir de la partida"
        onClose={close}
        actions={
          <Button variant="primary" onClick={close}>
            Entendido
          </Button>
        }
      >
        <p>
          Eres la única persona de la partida y el facilitador no puede salir sin ceder el rol.
          Cuando entre alguien más podrás elegirle como sucesor.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Elige quién se queda como facilitador"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={selected === null}
            onClick={() => {
              if (selected !== null) onConfirm(selected);
            }}
          >
            Ceder y salir
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-2 text-xs" style={{ color: 'var(--pp-muted)' }}>
          Para salir tienes que dejar a alguien al mando de los ajustes y del revelado.
        </legend>
        {ordered.map((candidate) => (
          <label
            key={candidate.id}
            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5"
            style={{
              border:
                selected === candidate.id
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--pp-line)',
              opacity: candidate.online ? 1 : 0.6,
            }}
          >
            <input
              type="radio"
              name="successor"
              value={candidate.id}
              checked={selected === candidate.id}
              onChange={() => {
                setPicked(candidate.id);
              }}
            />
            <span className="min-w-0 flex-1 truncate">{candidate.displayName}</span>
            {candidate.online ? null : (
              <span className="text-[11px]" style={{ color: 'var(--pp-muted)' }}>
                desconectado
              </span>
            )}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
