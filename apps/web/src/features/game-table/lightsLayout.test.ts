import { describe, expect, it } from 'vitest';
import { COMPACT_BULB_BOX, compactLightsLayout, lightsLayout } from './lightsLayout.js';
import { compactSeatPosition, seatPosition } from './seatLayout.js';

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

describe('guirnalda de la mesa compacta del móvil', () => {
  const gridSeats = (n: number): Array<{ id: string; seat: ReturnType<typeof seatPosition> }> =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i.toString()}`,
      seat: compactSeatPosition(i, n),
    }));

  it('cada asiento tiene su tramo de luces, también los del centro de la rejilla', () => {
    const owners = new Set(compactLightsLayout(gridSeats(12), 34, 1.2).map((b) => b.ownerId));

    expect(owners.size).toBe(12);
  });

  it('cada tramo es seguido: las luces de un asiento no se mezclan con las de otro', () => {
    const owners = compactLightsLayout(gridSeats(6), 34, 1.5).map((bulb) => bulb.ownerId);
    const changes = owners.filter((owner, i) => i > 0 && owner !== owners[i - 1]).length;

    expect(changes).toBe(5);
  });

  it('las luces van por el borde del tapete, no por dentro', () => {
    const { halfX, halfY } = COMPACT_BULB_BOX;
    for (const bulb of compactLightsLayout(gridSeats(8), 34, 1.5)) {
      const onVerticalEdge = Math.abs(Math.abs(bulb.left - 50) - halfX) < 0.01;
      const onHorizontalEdge = Math.abs(Math.abs(bulb.top - 50) - halfY) < 0.01;
      const inCorner = Math.abs(bulb.left - 50) > 6 && Math.abs(bulb.top - 50) > 24;
      expect(onVerticalEdge || onHorizontalEdge || inCorner).toBe(true);
    }
  });

  it('sin nadie sentado las luces no son de nadie', () => {
    expect(compactLightsLayout([], 10, 1.5).every((bulb) => bulb.ownerId === null)).toBe(true);
  });
});
