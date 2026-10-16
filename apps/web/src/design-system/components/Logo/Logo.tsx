import { useId } from 'react';
import type { JSX } from 'react';

export interface LogoProps {
  readonly size?: number;
  /** Si se pasa, el logo se anuncia como imagen con este nombre; si no, es decorativo. */
  readonly title?: string;
}

/** Por debajo de este tamaño las muescas y el 8 se emborronan: se pinta la versión simple. */
const DETAIL_MIN_SIZE = 24;
const CARD_TRANSFORM = 'rotate(12 32.5 30.5)';

interface MaskProps {
  readonly id: string;
  readonly detailed: boolean;
}

function ChipMask({ id, detailed }: MaskProps): JSX.Element {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
      <rect width="48" height="48" fill="white" />
      {detailed ? (
        <circle
          cx="20"
          cy="22"
          r="15"
          fill="none"
          stroke="black"
          strokeWidth="4"
          strokeDasharray="5.5 6.28"
          strokeDashoffset="2.75"
        />
      ) : null}
      <circle cx="20" cy="22" r={detailed ? 10.5 : 10} fill="black" />
      <rect
        x="24"
        y="18"
        width="17"
        height="25"
        rx="3"
        fill="black"
        stroke="black"
        strokeWidth={detailed ? 2.5 : 4}
        transform={CARD_TRANSFORM}
      />
    </mask>
  );
}

function CardMask({ id, detailed }: MaskProps): JSX.Element {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
      <rect width="48" height="48" fill="white" />
      {detailed ? (
        <g fill="none" stroke="black" strokeWidth="2.2" transform={CARD_TRANSFORM}>
          <circle cx="32.5" cy="26.8" r="2.4" />
          <circle cx="32.5" cy="32.6" r="3" />
        </g>
      ) : null}
    </mask>
  );
}

/**
 * Ficha + carta ("Apuesta", docs/adr/0016-logo-ficha-apuesta.md). Las muescas, el hueco central
 * y el 8 son recortes con `mask`, no trazos del color del fondo: así el logo vale sobre
 * cualquier superficie sin saber cuál es.
 */
export function Logo({ size = 32, title }: LogoProps): JSX.Element {
  // `useId` devuelve caracteres que no son válidos dentro de `url(#…)` en todos los navegadores.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const chipMask = `pp-logo-chip-${id}`;
  const cardMask = `pp-logo-card-${id}`;
  const detailed = size >= DETAIL_MIN_SIZE;
  const a11y = title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title };

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...a11y}>
      <defs>
        <ChipMask id={chipMask} detailed={detailed} />
        <CardMask id={cardMask} detailed={detailed} />
      </defs>
      <circle
        cx="20"
        cy="22"
        r={detailed ? 17 : 19}
        fill="var(--color-accent)"
        mask={`url(#${chipMask})`}
      />
      <rect
        x="24"
        y="18"
        width="17"
        height="25"
        rx="3"
        fill="var(--pp-brand-warm)"
        transform={CARD_TRANSFORM}
        mask={`url(#${cardMask})`}
      />
    </svg>
  );
}
