import type { GameSettingsView, GameView } from '@pp/contracts';
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

function baseGame(): GameView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    deck: { cards: ['1', '2', '?', '☕'] },
    settings: baseSettings(),
    participants: [],
    issues: [],
    currentRound: null,
  };
}

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

  it('el primer state_sync con version 0 se aplica (partida sin eventos o API recién reiniciada)', () => {
    useGameStore.getState().connect('game-1', 'p1');
    const stateSync = handlers.get('state_sync');
    expect(stateSync).toBeDefined();

    stateSync?.({ type: 'state_sync', version: 0, state: baseGame() });

    expect(useGameStore.getState().game?.id).toBe('game-1');
  });

  it('un state_sync con version menor que la actual se aplica (el contador del servidor vive en memoria y se reinicia)', () => {
    useGameStore.setState({ version: 12 });
    const stateSync = handlers.get('state_sync');

    stateSync?.({ type: 'state_sync', version: 3, state: baseGame() });

    const state = useGameStore.getState();
    expect(state.game?.id).toBe('game-1');
    expect(state.version).toBe(3);
  });

  it('game_closed deja la mesa sin partida y con el aviso de que la sala se ha cerrado', () => {
    useGameStore.setState({ game: baseGame(), selectedCard: '3' });

    handlers.get('game_closed')?.({ type: 'game_closed' });

    const state = useGameStore.getState();
    expect(state.game).toBeNull();
    expect(state.selectedCard).toBeNull();
    expect(state.errorMessage).toMatch(/administrador/);
  });
});
