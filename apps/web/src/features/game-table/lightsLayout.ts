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

/**
 * Borde de la guirnalda en la mesa compacta del móvil: el rectángulo redondeado del tapete
 * (`border-radius: 44%/26%`) un poco hacia dentro. Semiancho, semialto y radios de las esquinas,
 * en % de la mesa.
 */
export const COMPACT_BULB_BOX = { halfX: 48, halfY: 47, cornerX: 42, cornerY: 23 };

interface OutlinePoint {
  readonly x: number;
  readonly y: number;
  /** Grados hacia fuera, como el ángulo de la elipse: -90 arriba, 0 a la derecha. */
  readonly angle: number;
}

const CORNER_STEPS = 24;

/** El borde en sentido horario desde arriba en el centro, como la guirnalda de la elipse. */
function compactOutline(): OutlinePoint[] {
  const { halfX, halfY, cornerX, cornerY } = COMPACT_BULB_BOX;
  const straightX = halfX - cornerX;
  const straightY = halfY - cornerY;
  const corners = [
    { cx: 50 + straightX, cy: 50 - straightY, from: -90 },
    { cx: 50 + straightX, cy: 50 + straightY, from: 0 },
    { cx: 50 - straightX, cy: 50 + straightY, from: 90 },
    { cx: 50 - straightX, cy: 50 - straightY, from: 180 },
  ];
  const points: OutlinePoint[] = [{ x: 50, y: 50 - halfY, angle: -90 }];
  for (const corner of corners) {
    for (let step = 0; step <= CORNER_STEPS; step++) {
      const angle = corner.from + (90 * step) / CORNER_STEPS;
      const radians = (angle * Math.PI) / 180;
      points.push({
        x: corner.cx + cornerX * Math.cos(radians),
        y: corner.cy + cornerY * Math.sin(radians),
        angle,
      });
    }
  }
  points.push({ x: 50, y: 50 - halfY, angle: 270 });
  return points;
}

/** Ángulo de un asiento desde el centro, de 0 a 2π en sentido horario empezando arriba. */
function clockwiseFromTop(seat: SeatPosition, aspect: number): number {
  const angle = Math.atan2(
    Number.parseFloat(seat.top) - 50,
    (Number.parseFloat(seat.left) - 50) * aspect,
  );
  return (angle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
}

interface OutlineSegment {
  readonly from: OutlinePoint;
  readonly to: OutlinePoint;
  readonly start: number;
  readonly length: number;
}

function outlineSegments(aspect: number): OutlineSegment[] {
  const outline = compactOutline();
  const segments: OutlineSegment[] = [];
  let start = 0;
  outline.forEach((to, index) => {
    const from = outline[index - 1];
    if (!from) return;
    const length = Math.hypot((to.x - from.x) * aspect, to.y - from.y);
    segments.push({ from, to, start, length });
    start += length;
  });
  return segments;
}

function pointAlong(segments: ReadonlyArray<OutlineSegment>, distance: number): OutlinePoint {
  const segment = segments.find((candidate) => candidate.start + candidate.length >= distance);
  if (!segment) return { x: 50, y: 50, angle: 0 };
  const t = segment.length > 0 ? (distance - segment.start) / segment.length : 0;
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * t,
    y: segment.from.y + (segment.to.y - segment.from.y) * t,
    angle: segment.from.angle,
  };
}

/** Asientos en el orden en que caen alrededor del centro; a igual ángulo, primero el de más afuera. */
function seatsAroundCenter(
  seats: ReadonlyArray<{ readonly id: string; readonly seat: SeatPosition }>,
  aspect: number,
): string[] {
  return seats
    .map((seat) => ({
      id: seat.id,
      angle: clockwiseFromTop(seat.seat, aspect),
      distance: Math.hypot(
        (Number.parseFloat(seat.seat.left) - 50) * aspect,
        Number.parseFloat(seat.seat.top) - 50,
      ),
    }))
    .sort((a, b) => a.angle - b.angle || b.distance - a.distance)
    .map((seat) => seat.id);
}

/**
 * Guirnalda de la mesa compacta del móvil (ADR 0032). Las bombillas se reparten por igual a lo
 * largo del borde; `aspect` (ancho / alto de la mesa) hace que el reparto sea uniforme en píxeles
 * y no en %. En la rejilla hay asientos en el centro que no tienen borde delante, así que el
 * borde se trocea en tramos iguales, uno por asiento en el orden en que caen alrededor del centro:
 * cada uno sigue encendiendo su tramo al votar.
 */
export function compactLightsLayout(
  seats: ReadonlyArray<{ readonly id: string; readonly seat: SeatPosition }>,
  count: number,
  aspect: number,
): Bulb[] {
  const segments = outlineSegments(aspect);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const owners = seatsAroundCenter(seats, aspect);
  return Array.from({ length: count }, (_, index) => {
    const point = pointAlong(segments, (index / count) * total);
    return {
      left: point.x,
      top: point.y,
      rotate: point.angle + 90,
      ownerId: owners[Math.floor((index * owners.length) / count)] ?? null,
    };
  });
}
