import { describe, expect, it } from 'vitest';
import { orderSeatsWithViewerAt, seatPosition } from './seatLayout.js';

describe('seatPosition', () => {
  it('el índice 4 cae abajo del centro (left 50%, top máximo)', () => {
    const seat = seatPosition(4, 9);
    expect(Number.parseFloat(seat.left)).toBeCloseTo(50, 0);
    expect(Number.parseFloat(seat.top)).toBeCloseTo(96, 0);
  });
});

describe('orderSeatsWithViewerAt', () => {
  it('coloca siempre al viewer en el asiento de abajo, sin importar su posición original', () => {
    const participants = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const seats = orderSeatsWithViewerAt(participants, 'b');
    const mine = seats.find((s) => s.id === 'b');
    expect(Number.parseFloat(mine?.seat.left ?? '')).toBeCloseTo(50, 5);
    expect(Number.parseFloat(mine?.seat.top ?? '')).toBeCloseTo(96, 5);
  });

  it('con una lista vacía no lanza y devuelve []', () => {
    expect(orderSeatsWithViewerAt([], 'a')).toEqual([]);
  });
});
