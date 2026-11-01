import { describe, expect, it } from 'vitest';
import { iconForSeed } from './Icon.js';

describe('iconForSeed', () => {
  it('da siempre el mismo icono para el mismo id', () => {
    expect(iconForSeed('plataforma')).toBe(iconForSeed('plataforma'));
  });

  it('reparte ids distintos entre iconos distintos', () => {
    const icons = new Set(['plataforma', 'pagos', 'g1', 'g2', 'g3', 'g4'].map(iconForSeed));
    expect(icons.size).toBeGreaterThan(1);
  });
});
