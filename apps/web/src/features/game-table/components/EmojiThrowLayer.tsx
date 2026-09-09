import type { JSX } from 'react';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import type { SeatPosition } from '../seatLayout.js';

export interface EmojiThrowLayerProps {
  readonly emojisInFlight: ReadonlyArray<EmojiInFlight>;
  readonly seatsById: ReadonlyMap<string, SeatPosition>;
}

/**
 * Aterriza el emoji directamente sobre el asiento de destino con `ppReact` (sube y se desvanece).
 * No reproduce el arco de vuelo completo del prototipo (cubic-bezier en top/left durante 620ms) —
 * recorte de alcance deliberado; el efecto de "te ha llegado una reacción" queda igual de claro.
 */
export function EmojiThrowLayer({ emojisInFlight, seatsById }: EmojiThrowLayerProps): JSX.Element {
  return (
    <>
      {emojisInFlight.map((entry) => {
        const seat = seatsById.get(entry.toParticipantId ?? entry.fromParticipantId);
        if (!seat) return null;
        return (
          <span
            key={entry.id}
            className="pointer-events-none absolute z-10 -translate-x-1/2 text-2xl"
            style={{ left: seat.left, top: seat.top, animation: 'ppReact 2.2s ease-out forwards' }}
          >
            {entry.emoji}
          </span>
        );
      })}
    </>
  );
}
