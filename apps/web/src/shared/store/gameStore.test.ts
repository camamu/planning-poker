import type { GameSettingsView } from '@pp/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore.js';

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
}));

vi.mock('../socket/connection.js', () => ({
  getSocket: () => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
    },
  }),
}));

function baseSettings(): GameSettingsView {
  return {
    autoReveal: false,
    whoCanReveal: 'ANYONE',
    namedRevealers: [],
    allowVoteChange: true,
    celebrate: true,
    throwEmojis: false,
    countdownSeconds: null,
    revealOnTimeout: false,
  };
}

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

  it('connect() reinicia version a 0 al cambiar de partida', () => {
    useGameStore.setState({ version: 12 });
    useGameStore.getState().connect('game-2', 'p1');
    expect(useGameStore.getState().version).toBe(0);
  });

  it('un settings_changed con version <= la actual se descarta (evento desordenado o duplicado)', () => {
    useGameStore.setState({ version: 5 });
    const settingsChanged = handlers.get('settings_changed');
    expect(settingsChanged).toBeDefined();

    settingsChanged?.({
      type: 'settings_changed',
      version: 5,
      settings: { ...baseSettings(), throwEmojis: true },
    });

    const state = useGameStore.getState();
    expect(state.version).toBe(5);
    expect(state.game).toBeNull();
  });

  it('un settings_changed con version mayor que la actual sí se aplica', () => {
    useGameStore.setState({ version: 5 });
    const settingsChanged = handlers.get('settings_changed');

    settingsChanged?.({
      type: 'settings_changed',
      version: 6,
      settings: { ...baseSettings(), throwEmojis: true },
    });

    expect(useGameStore.getState().version).toBe(6);
  });
});
