import type { CSSProperties, JSX } from 'react';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import type { SeatPosition, ThrowOffset } from '../seatLayout.js';

export const THROW_FLIGHT_MS = 620;
export const THROW_TOTAL_MS = 1000;

/** `CSSProperties` no admite custom properties por defecto; `ppThrowArc` las necesita para su geometría por lanzamiento. */
type ThrowStyle = CSSProperties & { [key: `--pp-${string}`]: string };

export interface EmojiThrowLayerProps {
  readonly emojisInFlight: ReadonlyArray<EmojiInFlight>;
  readonly seatsById: ReadonlyMap<string, SeatPosition>;
  readonly flightGeometryById: ReadonlyMap<string, ThrowOffset>;
}

function isRealThrow(entry: EmojiInFlight): boolean {
  return entry.toParticipantId !== null && entry.toParticipantId !== entry.fromParticipantId;
}

/**
 * Un lanzamiento real (asiento de destino distinto del remitente) parte del asiento del remitente
 * y recorre un arco hasta el destino con `ppThrowArc` (parábola + rebote, `THROW_TOTAL_MS`).
 * Una autorreacción, o un lanzamiento cuya geometría de vuelo no se pudo calcular todavía
 * (p. ej. el contenedor no se ha medido aún), cae al efecto `ppReact` de siempre sobre el
 * mejor asiento conocido, en vez de desaparecer.
 */
export function EmojiThrowLayer({
  emojisInFlight,
  seatsById,
  flightGeometryById,
}: EmojiThrowLayerProps): JSX.Element {
  return (
    <>
      {emojisInFlight.map((entry) => {
        const geometry = flightGeometryById.get(entry.id);
        const throwing = isRealThrow(entry) && geometry !== undefined;
        const anchorSeat = throwing
          ? seatsById.get(entry.fromParticipantId)
          : seatsById.get(entry.toParticipantId ?? entry.fromParticipantId);
        if (!anchorSeat) return null;

        const style: ThrowStyle = throwing
          ? {
              left: anchorSeat.left,
              top: anchorSeat.top,
              '--pp-dx': `${geometry.dxPx.toString()}px`,
              '--pp-dy': `${geometry.dyPx.toString()}px`,
              '--pp-arc': `${geometry.arcHeightPx.toString()}px`,
              animation: `ppThrowArc ${THROW_TOTAL_MS.toString()}ms ease-out forwards`,
            }
          : {
              left: anchorSeat.left,
              top: anchorSeat.top,
              animation: 'ppReact 2.2s ease-out forwards',
            };

        return (
          <span
            key={entry.id}
            className="pointer-events-none absolute z-10 -translate-x-1/2 text-2xl"
            style={style}
          >
            {entry.emoji}
          </span>
        );
      })}
    </>
  );
}
