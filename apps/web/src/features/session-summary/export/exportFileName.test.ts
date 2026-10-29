import { describe, expect, it } from 'vitest';
import { csvFileName } from './exportFileName.js';

const day = new Date(2026, 2, 7, 12, 0, 0);

describe('csvFileName', () => {
  it('sigue el patrón planning-<nombre>-<aaaa-mm-dd>.csv con la fecha completada con ceros', () => {
    expect(csvFileName('Sprint 42', day)).toBe('planning-sprint-42-2026-03-07.csv');
  });

  it('quita tildes y signos del nombre de la partida', () => {
    expect(csvFileName('  Planificación: ¡Q2/2026! ', day)).toBe(
      'planning-planificacion-q2-2026-2026-03-07.csv',
    );
  });

  it('usa «partida» cuando el nombre no tiene letras ni números aprovechables', () => {
    expect(csvFileName('🎲🎲', day)).toBe('planning-partida-2026-03-07.csv');
  });

  it('recorta los nombres muy largos sin dejar un guion colgando', () => {
    const name = `${'a'.repeat(49)} ${'b'.repeat(30)}`;

    expect(csvFileName(name, day)).toBe(`planning-${'a'.repeat(49)}-2026-03-07.csv`);
  });
});
