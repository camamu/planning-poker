import type { SeatPosition } from './seatLayout.js';

export interface Bulb {
  /** % del ancho y del alto de la mesa, igual que los asientos. */
  readonly left: number;
  readonly top: number;
  /** Grados: la bombilla apunta hacia fuera de la mesa. */
  readonly rotate: number;
  /** Asiento cuyas luces son: se encienden cuando esa persona vota. */
  readonly ownerId: string | null;
}

/** Radios de la elipse de asientos (`seatPosition`) y de la guirnalda, sobre el aro de la mesa. */
const SEAT_RADIUS = { x: 44, y: 46 };
export const BULB_RADIUS = { x: 49, y: 48.3 };

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
}

/**
 * Guirnalda del borde de la mesa en temporada de invierno (ADR 0031). Cada bombilla es del
 * asiento más cercano por ángulo, así que cada uno «enciende» el tramo de borde que tiene delante.
 */
export function lightsLayout(
  seats: ReadonlyArray<{ readonly id: string; readonly seat: SeatPosition }>,
  count: number,
): Bulb[] {
  const seatAngles = seats.map((seat) => ({
    id: seat.id,
    angle: Math.atan2(
      (Number.parseFloat(seat.seat.top) - 50) / SEAT_RADIUS.y,
      (Number.parseFloat(seat.seat.left) - 50) / SEAT_RADIUS.x,
    ),
  }));
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
    let ownerId: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const seat of seatAngles) {
      const distance = angularDistance(angle, seat.angle);
      if (distance < best) {
        best = distance;
        ownerId = seat.id;
      }
    }
    return {
      left: 50 + BULB_RADIUS.x * Math.cos(angle),
      top: 50 + BULB_RADIUS.y * Math.sin(angle),
      rotate: (angle * 180) / Math.PI + 90,
      ownerId,
    };
  });
}
