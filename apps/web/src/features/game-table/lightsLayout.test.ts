import { describe, expect, it } from 'vitest';
import { lightsLayout } from './lightsLayout.js';
import { seatPosition } from './seatLayout.js';

const seats = (n: number): Array<{ id: string; seat: ReturnType<typeof seatPosition> }> =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i.toString()}`, seat: seatPosition(i, n) }));

describe('guirnalda de la mesa', () => {
  it('cada asiento tiene su tramo de luces', () => {
    const owners = new Set(lightsLayout(seats(6), 34).map((bulb) => bulb.ownerId));

    expect(owners.size).toBe(6);
  });

  it('la luz de abajo del todo es del asiento de abajo, que siempre es el tuyo', () => {
    const bulbs = lightsLayout(seats(5), 34);
    const bottom = bulbs.reduce((a, b) => (b.top > a.top ? b : a));

    expect(bottom.ownerId).toBe('p4');
  });

  it('sin nadie sentado las luces no son de nadie', () => {
    expect(lightsLayout([], 10).every((bulb) => bulb.ownerId === null)).toBe(true);
  });

  it('las luces van por el borde de la mesa, fuera de la elipse de asientos', () => {
    for (const bulb of lightsLayout(seats(4), 20)) {
      const x = (bulb.left - 50) / 49;
      const y = (bulb.top - 50) / 48.3;
      expect(x * x + y * y).toBeCloseTo(1);
    }
  });
});
