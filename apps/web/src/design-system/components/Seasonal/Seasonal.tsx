import type { JSX } from 'react';

const ARMS = [0, 60, 120, 180, 240, 300];

/** Copo de seis brazos con `currentColor`: hereda el color de quien lo contiene. */
export function Snowflake({ size }: { readonly size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        {ARMS.map((angle) => (
          <path
            key={angle}
            transform={`rotate(${angle.toString()})`}
            d="M0 0V-8.5M0-5.2l-2.4-2.2M0-5.2l2.4-2.2"
          />
        ))}
      </g>
    </svg>
  );
}

/** Ramita de acebo para la esquina de la carta revelada. */
export function Holly({ size }: { readonly size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 12C9 6 4 7 2 9c2 .5 2 2.5 1 3.5 2-.5 3 1.5 2.5 3C8 14 11 14 12 12Z"
        fill="var(--pp-holly)"
      />
      <path
        d="M12 12c3-6 8-5 10-3-2 .5-2 2.5-1 3.5-2-.5-3 1.5-2.5 3C16 14 13 14 12 12Z"
        fill="var(--pp-holly)"
        opacity="0.85"
      />
      <circle cx="10.5" cy="13.6" r="2.4" fill="var(--pp-berry)" />
      <circle cx="13.8" cy="14.1" r="2.4" fill="var(--pp-berry)" opacity="0.85" />
      <circle cx="12.1" cy="11.2" r="2.2" fill="var(--pp-berry)" />
    </svg>
  );
}
