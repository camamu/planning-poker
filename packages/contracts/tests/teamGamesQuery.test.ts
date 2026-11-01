import { describe, expect, it } from 'vitest';
import {
  TEAM_GAMES_DEFAULT_LIMIT,
  TEAM_GAMES_MAX_LIMIT,
  teamGamesQuerySchema,
} from '../src/index.js';

describe('teamGamesQuerySchema', () => {
  it('sin parámetros pide la primera página con el límite por defecto', () => {
    expect(teamGamesQuerySchema.parse({})).toEqual({ limit: TEAM_GAMES_DEFAULT_LIMIT });
  });

  it('convierte el límite de la query string en número', () => {
    expect(teamGamesQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });

  it('rechaza un límite fuera de rango o no entero', () => {
    for (const limit of ['0', '-1', '1.5', 'muchas', String(TEAM_GAMES_MAX_LIMIT + 1)]) {
      expect(teamGamesQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  });

  it('acepta como cursor la fecha ISO que devuelve la API y rechaza otra cosa', () => {
    expect(teamGamesQuerySchema.parse({ before: '2026-08-07T10:00:00.000Z' }).before).toBe(
      '2026-08-07T10:00:00.000Z',
    );
    expect(teamGamesQuerySchema.safeParse({ before: 'ayer' }).success).toBe(false);
  });

  it('ignora el token k, que lee la ruta aparte', () => {
    expect(teamGamesQuerySchema.parse({ k: 'token' })).toEqual({ limit: TEAM_GAMES_DEFAULT_LIMIT });
  });
});
