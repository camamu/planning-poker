import type { JSX } from 'react';
import { Snowflake } from '../../design-system/index.js';

const STRIPS = [0, 1, 2, 3, 4, 5, 6];
const HUES = [289, 250, 200, 330, 30, 150, 100];

export interface ConfettiProps {
  /** En temporada de invierno caen copos dorados y blancos en vez de tiras (ADR 0031). */
  readonly variant?: 'confetti' | 'snow';
}

/** Unanimidad = confeti (docs/06-handoff-diseno.md). Respeta prefers-reduced-motion vía CSS. */
export function Confetti({ variant = 'confetti' }: ConfettiProps): JSX.Element {
  const snow = variant === 'snow';
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
      data-variant={variant}
    >
      {STRIPS.map((index) => {
        const left = `${(((index + 1) * 100) / (STRIPS.length + 1)).toString()}%`;
        if (snow) {
          return (
            <span
              key={index}
              className="absolute top-0 leading-none"
              style={{
                left,
                color: index % 3 === 1 ? 'var(--pp-snow)' : 'var(--pp-light)',
                animation: `ppConfeti ${(3.4 + (index % 4) * 0.3).toString()}s linear ${(index * 0.18).toString()}s infinite`,
              }}
            >
              <Snowflake size={16 + (index % 3) * 4} />
            </span>
          );
        }
        return (
          <span
            key={index}
            className="absolute top-0 h-3 w-1.5 rounded-sm"
            style={{
              left,
              background: `oklch(0.73 0.125 ${(HUES[index % HUES.length] ?? 0).toString()})`,
              animation: `ppConfeti ${(2.6 + (index % 4) * 0.2).toString()}s linear ${(index * 0.12).toString()}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}
