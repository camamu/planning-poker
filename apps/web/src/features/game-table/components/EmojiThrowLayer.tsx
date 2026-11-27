import { Fragment } from 'react';
import type { CSSProperties, JSX } from 'react';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import type { SeatPosition, ThrowOffset } from '../seatLayout.js';
import { SNOWBALL } from '../snowball.js';

export const THROW_FLIGHT_MS = 620;
export const THROW_TOTAL_MS = 1000;
/** El pegote de la bola de nieve dura lo que le queda al lanzamiento antes de que se retire (2,5 s). */
const SPLAT_MS = 1800;

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

        const snowball = entry.emoji === SNOWBALL;
        const target =
          throwing && entry.toParticipantId ? seatsById.get(entry.toParticipantId) : null;
        return (
          <Fragment key={entry.id}>
            <span
              className="pointer-events-none absolute z-10 -translate-x-1/2 text-2xl"
              style={style}
            >
              {snowball && throwing ? (
                <span className="pp-snowball" aria-hidden="true" />
              ) : (
                entry.emoji
              )}
            </span>
            {snowball && target ? (
              <span
                className="pp-snow-splat pointer-events-none absolute z-10"
                style={{
                  left: target.left,
                  top: target.top,
                  animation: `ppSnowSplat ${SPLAT_MS.toString()}ms ease-out ${THROW_FLIGHT_MS.toString()}ms both`,
                }}
                aria-hidden="true"
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
