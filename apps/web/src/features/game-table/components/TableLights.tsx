import type { CSSProperties, JSX } from 'react';
import { BULB_RADIUS, lightsLayout } from '../lightsLayout.js';
import type { SeatPosition } from '../seatLayout.js';

export interface TableLightsProps {
  readonly seats: ReadonlyArray<{ readonly id: string; readonly seat: SeatPosition }>;
  /** Solo quién ha votado, nunca qué: antes de revelar es todo lo que se sabe (invariante 7). */
  readonly votedIds: ReadonlySet<string>;
  readonly revealed: boolean;
}

const BULB_COUNT = 34;

/** Color y orden de cada bombilla, que leen `ppTwinkle` y `ppChase` (tokens/season.css). */
type BulbStyle = CSSProperties & { [key: `--pp-${string}`]: string };

/**
 * Guirnalda del borde de la mesa en invierno (ADR 0031): el tramo de cada asiento se enciende al
 * votar, todo titila cuando ya ha votado la mesa entera y hace una ola al revelar.
 */
export function TableLights({ seats, votedIds, revealed }: TableLightsProps): JSX.Element {
  const bulbs = lightsLayout(seats, BULB_COUNT);
  const everyoneVoted = seats.length > 0 && seats.every((seat) => votedIds.has(seat.id));

  return (
    <div
      className="pp-lights pointer-events-none absolute inset-0"
      data-all={everyoneVoted && !revealed}
      data-chase={revealed}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <ellipse
          cx="50"
          cy="50"
          rx={BULB_RADIUS.x}
          ry={BULB_RADIUS.y}
          fill="none"
          stroke="var(--pp-light-wire)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {bulbs.map((bulb, index) => {
        const style: BulbStyle = {
          left: `${bulb.left.toFixed(2)}%`,
          top: `${bulb.top.toFixed(2)}%`,
          transform: `rotate(${bulb.rotate.toFixed(1)}deg)`,
          '--pp-bulb': index % 5 === 2 ? 'var(--pp-light-soft)' : 'var(--pp-light)',
          '--pp-i': index.toString(),
        };
        return (
          <span
            key={index}
            className="pp-bulb"
            data-on={bulb.ownerId !== null && votedIds.has(bulb.ownerId)}
            style={style}
          />
        );
      })}
    </div>
  );
}
