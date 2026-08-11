import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore.js';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      status: 'idle',
      game: null,
      version: 0,
      gameId: null,
      participantId: null,
      errorMessage: null,
      selectedCard: null,
      theme: 'dark',
      muted: false,
    });
  });

  it('toggleTheme alterna entre dark y light', () => {
    useGameStore.getState().toggleTheme();
    expect(useGameStore.getState().theme).toBe('light');
    useGameStore.getState().toggleTheme();
    expect(useGameStore.getState().theme).toBe('dark');
  });

  it('toggleMuted alterna el silencio', () => {
    useGameStore.getState().toggleMuted();
    expect(useGameStore.getState().muted).toBe(true);
  });

  it('castVote sin gameId/participantId (todavía no conectado) no hace nada', () => {
    useGameStore.getState().castVote('5');
    expect(useGameStore.getState().selectedCard).toBeNull();
  });

  it('connect() fija gameId/participantId y pasa a "connecting"', () => {
    useGameStore.getState().connect('game-1', 'p1');
    const state = useGameStore.getState();
    expect(state.gameId).toBe('game-1');
    expect(state.participantId).toBe('p1');
    expect(state.status).toBe('connecting');
  });
});
