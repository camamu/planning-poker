import { describe, expect, it } from 'vitest';
import { isWinterSeason, parseSeasonOverride, resolveSeason } from './season.js';

const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date);

describe('temporada de invierno', () => {
  it('no ha empezado el 30 de noviembre', () => {
    expect(isWinterSeason(day(2026, 11, 30))).toBe(false);
  });

  it('empieza el 1 de diciembre', () => {
    expect(isWinterSeason(day(2026, 12, 1))).toBe(true);
  });

  it('sigue en Nochevieja', () => {
    expect(isWinterSeason(day(2026, 12, 31))).toBe(true);
  });

  it('el 6 de enero, Reyes, es el último día', () => {
    expect(isWinterSeason(day(2027, 1, 6))).toBe(true);
  });

  it('ha terminado el 7 de enero', () => {
    expect(isWinterSeason(day(2027, 1, 7))).toBe(false);
  });
});

describe('vista previa con ?temporada=', () => {
  it('?temporada=invierno fuerza la ambientación fuera de fechas', () => {
    expect(resolveSeason(day(2026, 7, 15), parseSeasonOverride('?temporada=invierno'))).toBe(
      'winter',
    );
  });

  it('?temporada=no la quita en plena temporada', () => {
    expect(resolveSeason(day(2026, 12, 24), parseSeasonOverride('?temporada=no'))).toBeNull();
  });

  it('sin parámetro manda la fecha', () => {
    expect(resolveSeason(day(2026, 12, 24), parseSeasonOverride(''))).toBe('winter');
    expect(resolveSeason(day(2026, 7, 15), parseSeasonOverride('?otra=cosa'))).toBeNull();
  });
});
