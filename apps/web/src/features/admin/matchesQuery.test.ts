import { describe, expect, it } from 'vitest';
import { matchesQuery } from './matchesQuery.js';

describe('matchesQuery', () => {
  it('sin búsqueda, todo coincide', () => {
    expect(matchesQuery('  ', 'Sprint 42')).toBe(true);
  });

  it('ignora mayúsculas y tildes', () => {
    expect(matchesQuery('diseno', 'Equipo de Diseño')).toBe(true);
  });

  it('busca en cualquiera de los campos y tolera campos ausentes', () => {
    expect(matchesQuery('backend', 'Sprint 42', null, 'Backend')).toBe(true);
    expect(matchesQuery('frontend', 'Sprint 42', undefined)).toBe(false);
  });
});
