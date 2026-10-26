import type { JSX } from 'react';
import { Button } from '../../../design-system/index.js';

export interface FacilitatorAbsentBannerProps {
  readonly facilitatorName: string | null;
  readonly onClaim: () => void;
}

/** Discreto a propósito: el facilitador puede estar solo reconectando (ADR 0021). */
export function FacilitatorAbsentBanner({
  facilitatorName,
  onClaim,
}: FacilitatorAbsentBannerProps): JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-none flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs"
      style={{ background: 'var(--color-accent-900)', color: 'var(--color-accent-200)' }}
    >
      <span>
        {facilitatorName
          ? `El facilitador (${facilitatorName}) no está conectado.`
          : 'El facilitador no está conectado.'}
      </span>
      <Button variant="secondary" onClick={onClaim}>
        Tomar el relevo
      </Button>
    </div>
  );
}
