import type { EphemeralEvent, GameView, ServerEvent } from '@pp/contracts';
import { create } from 'zustand';
import { getSocket } from '../socket/connection.js';
import { gameEventsReducer, needsResync } from '../socket/gameEventsReducer.js';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface EmojiInFlight {
  readonly id: string;
  readonly fromParticipantId: string;
  readonly toParticipantId: string | null;
  readonly emoji: string;
}

export interface DiscussionTimerState {
  readonly roundId: string;
  readonly running: boolean;
  readonly remainingMs: number;
  /** `Date.now()` en el momento de este snapshot — deja interpolar el conteo entre syncs. */
  readonly syncedAt: number;
}

type DiscussionTimerAction = 'start' | 'pause' | 'resume' | 'reset' | 'addSeconds';

interface GameStoreState {
  readonly status: ConnectionStatus;
  readonly game: GameView | null;
  readonly version: number;
  readonly gameId: string | null;
  readonly participantId: string | null;
  readonly errorMessage: string | null;
  /** Última carta que YO he votado — el servidor nunca la re-envía por invariante 7 (docs/02
   *  §4.3); esto es lo único que hace que mi propia carta se vea boca arriba antes del reveal. */
  readonly selectedCard: string | null;
  readonly theme: 'dark' | 'light';
  readonly muted: boolean;
  readonly emojiMode: 'throw' | 'react';
  readonly armedEmoji: string | null;
  readonly emojisInFlight: ReadonlyArray<EmojiInFlight>;
  readonly discussionTimer: DiscussionTimerState | null;

  connect: (gameId: string, participantId: string) => void;
  castVote: (card: string) => void;
  startRound: (issueId: string) => void;
  reveal: () => void;
  timeoutReveal: () => void;
  toggleTheme: () => void;
  toggleMuted: () => void;
  setEmojiMode: (mode: 'throw' | 'react') => void;
  armEmoji: (emoji: string | null) => void;
  sendEmoji: (toParticipantId: string | null, emoji: string) => void;
  dismissEmoji: (id: string) => void;
  controlDiscussionTimer: (
    roundId: string,
    action: DiscussionTimerAction,
    seconds?: number,
  ) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  status: 'idle',
  game: null,
  version: 0,
  gameId: null,
  participantId: null,
  errorMessage: null,
  selectedCard: null,
  theme: 'dark',
  muted: false,
  emojiMode: 'throw',
  armedEmoji: null,
  emojisInFlight: [],
  discussionTimer: null,

  connect(gameId, participantId) {
    set({
      gameId,
      participantId,
      status: 'connecting',
      errorMessage: null,
      game: null,
      selectedCard: null,
    });
    const socket = getSocket();
    // Reconecta si ya había una conexión: Socket.IO no abandona rooms anteriores por sí solo, y
    // un socket que arrastrara la room de otra partida seguiría recibiendo sus eventos. Si el
    // socket no se ha conectado nunca, desconectar antes de conectar solo añade un intento fallido.
    if (socket.connected) socket.disconnect();
    socket.connect();
    socket.emit('join', { gameId, participantId });
  },

  castVote(card) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    set({ selectedCard: card });
    getSocket().emit('vote', { gameId, participantId, card });
  },

  startRound(issueId) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    set({ selectedCard: null });
    getSocket().emit('start_round', { gameId, participantId, issueId });
  },

  reveal() {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('reveal', { gameId, participantId });
  },

  timeoutReveal() {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('timeout_reveal', { gameId, participantId });
  },

  toggleTheme() {
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },

  toggleMuted() {
    set((state) => ({ muted: !state.muted }));
  },

  setEmojiMode(mode) {
    set({ emojiMode: mode, armedEmoji: null });
  },

  armEmoji(emoji) {
    set({ armedEmoji: emoji });
  },

  sendEmoji(toParticipantId, emoji) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('emoji_thrown', { gameId, participantId, toParticipantId, emoji });
    set({ armedEmoji: null });
  },

  dismissEmoji(id) {
    set((state) => ({ emojisInFlight: state.emojisInFlight.filter((entry) => entry.id !== id) }));
  },

  controlDiscussionTimer(roundId, action, seconds) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('discussion_timer_control', {
      gameId,
      participantId,
      roundId,
      action,
      ...(seconds !== undefined ? { seconds } : {}),
    });
  },
}));

function applyEvent(event: ServerEvent): void {
  const { game, gameId, participantId } = useGameStore.getState();
  const next = gameEventsReducer(game, event);
  useGameStore.setState({ game: next, version: event.version });

  if (needsResync(event.type) && gameId && participantId) {
    getSocket().emit('join', { gameId, participantId });
  }
}

// Los listeners se registran una única vez a nivel de módulo: `getSocket()` devuelve el mismo
// socket durante toda la vida de la app, y volver a registrarlos en cada `connect()` los apilaría.
const socket = getSocket();

socket.on('connect', () => {
  useGameStore.setState({ status: 'connected' });
});
socket.on('disconnect', () => {
  useGameStore.setState({ status: 'disconnected' });
});
socket.on('error', (event: { message: string }) => {
  useGameStore.setState({ errorMessage: event.message });
});
socket.on('state_sync', (event: Extract<ServerEvent, { type: 'state_sync' }>) => {
  applyEvent(event);
});
socket.on('participant_joined', (event: Extract<ServerEvent, { type: 'participant_joined' }>) => {
  applyEvent(event);
});
socket.on(
  'participant_role_changed',
  (event: Extract<ServerEvent, { type: 'participant_role_changed' }>) => {
    applyEvent(event);
  },
);
socket.on('issue_added', (event: Extract<ServerEvent, { type: 'issue_added' }>) => {
  applyEvent(event);
});
socket.on('round_started', (event: Extract<ServerEvent, { type: 'round_started' }>) => {
  applyEvent(event);
});
socket.on('participant_voted', (event: Extract<ServerEvent, { type: 'participant_voted' }>) => {
  applyEvent(event);
});
socket.on('vote_retracted', (event: Extract<ServerEvent, { type: 'vote_retracted' }>) => {
  applyEvent(event);
});
socket.on('round_revealed', (event: Extract<ServerEvent, { type: 'round_revealed' }>) => {
  applyEvent(event);
});
socket.on('issue_estimated', (event: Extract<ServerEvent, { type: 'issue_estimated' }>) => {
  applyEvent(event);
});
socket.on('settings_changed', (event: Extract<ServerEvent, { type: 'settings_changed' }>) => {
  applyEvent(event);
});

// `emoji_thrown`/`discussion_timer_sync` son EphemeralEvent, no ServerEvent: no llevan `version`
// y no pasan por gameEventsReducer (docs/adr/0005-extension-de-alcance-bloque-6.md).
socket.on('emoji_thrown', (event: Extract<EphemeralEvent, { type: 'emoji_thrown' }>) => {
  const id = crypto.randomUUID();
  useGameStore.setState((state) => ({
    emojisInFlight: [
      ...state.emojisInFlight,
      {
        id,
        fromParticipantId: event.fromParticipantId,
        toParticipantId: event.toParticipantId,
        emoji: event.emoji,
      },
    ],
  }));
  setTimeout(() => {
    useGameStore.getState().dismissEmoji(id);
  }, 2500);
});
socket.on(
  'discussion_timer_sync',
  (event: Extract<EphemeralEvent, { type: 'discussion_timer_sync' }>) => {
    useGameStore.setState({
      discussionTimer: {
        roundId: event.roundId,
        running: event.running,
        remainingMs: event.remainingMs,
        syncedAt: Date.now(),
      },
    });
  },
);
