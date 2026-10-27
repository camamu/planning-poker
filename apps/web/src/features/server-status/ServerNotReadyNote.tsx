import type { JSX } from 'react';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';

const REASONS = {
  checking: 'Conectando con el servidor…',
  waking: 'Esperando a que el servidor despierte…',
  unreachable: 'El servidor no responde: reintenta desde el aviso de arriba.',
} as const;

/** El motivo de que un botón que necesita la API esté deshabilitado; no pinta nada con la API lista. */
export function ServerNotReadyNote(): JSX.Element | null {
  const status = useServerStatusStore((state) => state.status);
  if (status === 'ready') return null;

  return (
    <p role="status" className="text-center text-xs" style={{ color: 'var(--pp-muted)' }}>
      {REASONS[status]}
    </p>
  );
}
