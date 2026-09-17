import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmojiInFlight } from '../../../shared/store/gameStore.js';
import type { SeatPosition, ThrowOffset } from '../seatLayout.js';
import { EmojiThrowLayer } from './EmojiThrowLayer.js';

const seatA: SeatPosition = { left: '30%', top: '96%' };
const seatB: SeatPosition = { left: '70%', top: '4%' };

function makeEntry(overrides: Partial<EmojiInFlight> = {}): EmojiInFlight {
  return { id: 'e1', fromParticipantId: 'a', toParticipantId: 'b', emoji: '👏', ...overrides };
}

describe('EmojiThrowLayer', () => {
  it('un lanzamiento real con geometría se ancla en el asiento del remitente y anima con ppThrowArc', () => {
    const seatsById = new Map([
      ['a', seatA],
      ['b', seatB],
    ]);
    const flightGeometryById = new Map<string, ThrowOffset>([
      ['e1', { dxPx: 360, dyPx: -478, arcHeightPx: 120 }],
    ]);

    const { container } = render(
      <EmojiThrowLayer
        emojisInFlight={[makeEntry()]}
        seatsById={seatsById}
        flightGeometryById={flightGeometryById}
      />,
    );

    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.style.left).toBe(seatA.left);
    expect(span?.style.top).toBe(seatA.top);
    expect(span?.style.animation).toContain('ppThrowArc');
    expect(span?.style.getPropertyValue('--pp-dx')).toBe('360px');
    expect(span?.style.getPropertyValue('--pp-dy')).toBe('-478px');
    expect(span?.style.getPropertyValue('--pp-arc')).toBe('120px');
  });

  it('una autorreacción (sin destino distinto) usa ppReact sobre el propio asiento', () => {
    const seatsById = new Map([['a', seatA]]);

    const { container } = render(
      <EmojiThrowLayer
        emojisInFlight={[makeEntry({ toParticipantId: null })]}
        seatsById={seatsById}
        flightGeometryById={new Map()}
      />,
    );

    const span = container.querySelector('span');
    expect(span?.style.left).toBe(seatA.left);
    expect(span?.style.animation).toContain('ppReact');
  });

  it('un lanzamiento real sin geometría disponible cae al efecto ppReact sobre el mejor asiento conocido, sin desaparecer', () => {
    const seatsById = new Map([
      ['a', seatA],
      ['b', seatB],
    ]);

    const { container } = render(
      <EmojiThrowLayer
        emojisInFlight={[makeEntry()]}
        seatsById={seatsById}
        flightGeometryById={new Map()}
      />,
    );

    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.style.animation).toContain('ppReact');
    expect(span?.style.left).toBe(seatB.left);
  });
});
