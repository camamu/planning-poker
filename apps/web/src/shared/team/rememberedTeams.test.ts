import { beforeEach, describe, expect, it } from 'vitest';
import { forgetTeam, rememberTeam, rememberedTeams } from './rememberedTeams.js';

const backend = { slug: 'backend', name: 'Backend', token: 'tok-1' };
const mobile = { slug: 'mobile', name: 'Mobile', token: 'tok-2' };

describe('rememberedTeams', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin equipos guardados devuelve una lista vacía', () => {
    expect(rememberedTeams()).toEqual([]);
  });

  it('el último equipo usado queda el primero de la lista', () => {
    rememberTeam(backend);
    rememberTeam(mobile);
    expect(rememberedTeams().map((team) => team.slug)).toEqual(['mobile', 'backend']);
  });

  it('volver a un equipo ya guardado no lo duplica y refresca su token', () => {
    rememberTeam(backend);
    rememberTeam({ ...backend, token: 'tok-nuevo' });
    expect(rememberedTeams()).toEqual([{ ...backend, token: 'tok-nuevo' }]);
  });

  it('olvidar un equipo deja el resto intacto', () => {
    rememberTeam(backend);
    rememberTeam(mobile);
    forgetTeam('mobile');
    expect(rememberedTeams()).toEqual([backend]);
  });

  it('un localStorage corrupto no rompe la home', () => {
    localStorage.setItem('pp:teams', 'no-es-json');
    expect(rememberedTeams()).toEqual([]);
  });

  it('descarta entradas que no tienen la forma esperada', () => {
    localStorage.setItem('pp:teams', JSON.stringify([backend, { slug: 'roto' }]));
    expect(rememberedTeams()).toEqual([backend]);
  });
});
