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
