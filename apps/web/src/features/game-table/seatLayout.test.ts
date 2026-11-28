import { describe, expect, it } from 'vitest';
import {
  compactRows,
  compactSeatPosition,
  computeThrowOffset,
  orderSeatsWithViewerAt,
  seatPosition,
} from './seatLayout.js';

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

describe('computeThrowOffset', () => {
  const container = { width: 900, height: 520 };

  it('convierte la diferencia de posición porcentual de los dos asientos a píxeles', () => {
    const from = { left: '30%', top: '50%' };
    const to = { left: '70%', top: '50%' };

    const offset = computeThrowOffset(from, to, container);

    expect(offset.dxPx).toBeCloseTo(360, 5);
    expect(offset.dyPx).toBeCloseTo(0, 5);
  });

  it('el signo del desplazamiento indica la dirección del lanzamiento', () => {
    const from = { left: '70%', top: '96%' };
    const to = { left: '50%', top: '4%' };

    const offset = computeThrowOffset(from, to, container);

    expect(offset.dxPx).toBeLessThan(0);
    expect(offset.dyPx).toBeLessThan(0);
  });

  it('la altura del arco tiene un mínimo para que los tiros cortos también arqueen', () => {
    const from = { left: '50%', top: '50%' };
    const to = { left: '50%', top: '55%' };

    const offset = computeThrowOffset(from, to, container);

    expect(offset.arcHeightPx).toBeGreaterThanOrEqual(36);
  });

  it('la altura del arco tiene un máximo para que los tiros largos no se disparen', () => {
    const from = { left: '6%', top: '96%' };
    const to = { left: '94%', top: '4%' };

    const offset = computeThrowOffset(from, to, container);

    expect(offset.arcHeightPx).toBeLessThanOrEqual(120);
  });
});

describe('compactSeatPosition', () => {
  it('reparte los asientos en filas de cuatro', () => {
    expect(compactRows(4)).toBe(1);
    expect(compactRows(5)).toBe(2);
    expect(compactRows(12)).toBe(3);
    expect(compactSeatPosition(0, 8)).toEqual({ left: '12.5%', top: '25%' });
    expect(compactSeatPosition(7, 8)).toEqual({ left: '87.5%', top: '75%' });
  });

  it('centra la última fila cuando no está llena', () => {
    expect(compactSeatPosition(4, 6)).toEqual({ left: '37.5%', top: '75%' });
    expect(compactSeatPosition(5, 6)).toEqual({ left: '62.5%', top: '75%' });
  });

  it('con una sola persona, en el centro de la mesa', () => {
    expect(compactSeatPosition(0, 1)).toEqual({ left: '50%', top: '50%' });
  });
});
