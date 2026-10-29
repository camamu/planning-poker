import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_REMEMBERED_GAMES,
  forgetGame,
  rememberGame,
  rememberedGames,
} from './rememberedGames.js';

const sprint = { id: 'game-1', name: 'Sprint 42' };
const refinement = { id: 'game-2', name: 'Refinamiento' };

describe('rememberedGames', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin partidas guardadas devuelve una lista vacía', () => {
    expect(rememberedGames()).toEqual([]);
  });

  it('la última partida visitada queda la primera de la lista', () => {
    rememberGame(sprint);
    rememberGame(refinement);
    expect(rememberedGames().map((game) => game.id)).toEqual(['game-2', 'game-1']);
  });

  it('volver a una partida ya guardada no la duplica y refresca la fecha de visita', () => {
    rememberGame(sprint, new Date('2026-08-07T10:00:00Z'));
    rememberGame(refinement, new Date('2026-08-07T11:00:00Z'));
    rememberGame(sprint, new Date('2026-08-07T12:00:00Z'));

    expect(rememberedGames()).toEqual([
      { ...sprint, visitedAt: '2026-08-07T12:00:00.000Z' },
      { ...refinement, visitedAt: '2026-08-07T11:00:00.000Z' },
    ]);
  });

  it('solo conserva las últimas partidas visitadas', () => {
    for (let index = 0; index <= MAX_REMEMBERED_GAMES; index += 1) {
      rememberGame({ id: `game-${index.toString()}`, name: `Partida ${index.toString()}` });
    }

    const games = rememberedGames();
    expect(games).toHaveLength(MAX_REMEMBERED_GAMES);
    expect(games[0]?.id).toBe(`game-${MAX_REMEMBERED_GAMES.toString()}`);
    expect(games.some((game) => game.id === 'game-0')).toBe(false);
  });

  it('olvidar una partida deja el resto intacto', () => {
    rememberGame(sprint);
    rememberGame(refinement);
    forgetGame('game-2');
    expect(rememberedGames().map((game) => game.id)).toEqual(['game-1']);
  });

  it('un localStorage corrupto no rompe la portada', () => {
    localStorage.setItem('pp:games', 'no-es-json');
    expect(rememberedGames()).toEqual([]);
  });

  it('descarta entradas que no tienen la forma esperada', () => {
    const valid = { ...sprint, visitedAt: '2026-08-07T10:00:00.000Z' };
    localStorage.setItem('pp:games', JSON.stringify([valid, { id: 'roto' }]));
    expect(rememberedGames()).toEqual([valid]);
  });

  it('si el almacenamiento rechaza escribir no lanza', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => {
      rememberGame(sprint);
    }).not.toThrow();

    setItem.mockRestore();
  });
});
