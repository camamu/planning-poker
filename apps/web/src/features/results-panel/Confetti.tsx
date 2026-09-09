import type { JSX } from 'react';

const STRIPS = [0, 1, 2, 3, 4, 5, 6];
const HUES = [289, 250, 200, 330, 30, 150, 100];

/** Unanimidad = confeti (docs/06-handoff-diseno.md). Respeta prefers-reduced-motion vía CSS. */
export function Confetti(): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {STRIPS.map((index) => (
        <span
          key={index}
          className="absolute top-0 h-3 w-1.5 rounded-sm"
          style={{
            left: `${(((index + 1) * 100) / (STRIPS.length + 1)).toString()}%`,
            background: `oklch(0.73 0.125 ${(HUES[index % HUES.length] ?? 0).toString()})`,
            animation: `ppConfeti ${(2.6 + (index % 4) * 0.2).toString()}s linear ${(index * 0.12).toString()}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
