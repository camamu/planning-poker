export interface SeatPosition {
  readonly left: string;
  readonly top: string;
}

/**
 * Elipse de asientos (docs/06-handoff-diseno.md §1): `a = (90 + (i-4)*360/n) * PI/180`,
 * `left = 50 + 44cos(a)%`, `top = 50 + 46sin(a)%`. El índice 4 cae siempre abajo del centro.
 */
export function seatPosition(displayIndex: number, total: number): SeatPosition {
  const angle = ((90 + ((displayIndex - 4) * 360) / total) * Math.PI) / 180;
  const left = 50 + 44 * Math.cos(angle);
  const top = 50 + 46 * Math.sin(angle);
  return { left: `${left.toString()}%`, top: `${top.toString()}%` };
}

export interface ContainerSize {
  readonly width: number;
  readonly height: number;
}

export interface ThrowOffset {
  readonly dxPx: number;
  readonly dyPx: number;
  readonly arcHeightPx: number;
}

const MIN_ARC_HEIGHT_PX = 36;
const MAX_ARC_HEIGHT_PX = 120;
const ARC_HEIGHT_RATIO = 0.32;

function percentToPx(value: string, size: number): number {
  return (Number.parseFloat(value) / 100) * size;
}

/** Delta en píxeles entre dos asientos (posicionados en `%`) y la altura del arco de vuelo entre ellos. */
export function computeThrowOffset(
  from: SeatPosition,
  to: SeatPosition,
  container: ContainerSize,
): ThrowOffset {
  const dxPx = percentToPx(to.left, container.width) - percentToPx(from.left, container.width);
  const dyPx = percentToPx(to.top, container.height) - percentToPx(from.top, container.height);
  const distance = Math.hypot(dxPx, dyPx);
  const arcHeightPx = Math.min(
    MAX_ARC_HEIGHT_PX,
    Math.max(MIN_ARC_HEIGHT_PX, distance * ARC_HEIGHT_RATIO),
  );
  return { dxPx, dyPx, arcHeightPx };
}

/** Rota la lista para que `viewerId` caiga siempre en el índice 4 ("Tú" abajo del centro). */
export function orderSeatsWithViewerAt<T extends { readonly id: string }>(
  participants: ReadonlyArray<T>,
  viewerId: string,
  viewerDisplayIndex = 4,
): ReadonlyArray<T & { readonly seat: SeatPosition }> {
  const total = participants.length;
  if (total === 0) return [];

  const viewerIndex = participants.findIndex((participant) => participant.id === viewerId);
  const offset = viewerIndex === -1 ? 0 : viewerDisplayIndex - viewerIndex;

  return participants.map((participant, index) => ({
    ...participant,
    seat: seatPosition((((index + offset) % total) + total) % total, total),
  }));
}
