import type { EphemeralEvent, GameView, IssueView, ServerEvent } from '@pp/contracts';
import { create } from 'zustand';
import { editIssue, removeIssue, reorderIssues } from '../api/gamesClient.js';
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
  /** El propio participante salió de la partida (o lo quitaron): hay que mostrar la pantalla de salida. */
  readonly hasLeft: boolean;
  /** Voto propio pintado de forma optimista, antes de que el servidor confirme. La verdad es
   *  `currentRound.votes`, donde la proyección sí devuelve la carta del propio viewer (invariante
   *  7, docs/02 §4.3); esto solo cubre el hueco hasta que llega esa confirmación. */
  readonly selectedCard: string | null;
  /** Lo mismo para los votos en diferido, por tarea. La verdad es `asyncRounds[].ownCard`, que se
   *  recupera en el siguiente `state_sync`: `async_vote_cast` no reenvía la carta (invariante 7). */
  readonly asyncSelected: Readonly<Record<string, string>>;
  readonly theme: 'dark' | 'light';
  readonly muted: boolean;
  readonly emojiMode: 'throw' | 'react';
  readonly armedEmoji: string | null;
  readonly emojisInFlight: ReadonlyArray<EmojiInFlight>;
  readonly discussionTimer: DiscussionTimerState | null;

  connect: (gameId: string, participantId: string) => void;
  clearError: () => void;
  castVote: (card: string) => void;
  startRound: (issueId: string) => void;
  startQuickRound: () => void;
  reveal: () => void;
  timeoutReveal: () => void;
  /** Sin `issueId` cierra la ronda de la mesa; con él, una tarea revelada en diferido (ADR 0027). */
  setFinalEstimate: (card: string, issueId?: string) => void;
  openAsyncRounds: (issueIds: ReadonlyArray<string>) => void;
  castAsyncVote: (issueId: string, card: string) => void;
  /** Sin `issueIds` revela todas las rondas en diferido que tengan votos. */
  revealAsync: (issueIds?: ReadonlyArray<string>) => void;
  /** Optimista: pinta el cambio ya y lo revierte con un aviso si la API lo rechaza. */
  renameIssue: (issueId: string, title: string) => Promise<void>;
  deleteIssue: (issueId: string) => Promise<void>;
  /** `issueIds` es la cola entera en el orden nuevo, no solo las tareas que se han movido. */
  reorderIssueQueue: (issueIds: ReadonlyArray<string>) => Promise<void>;
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
  hasLeft: false,
  selectedCard: null,
  asyncSelected: {},
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
      hasLeft: false,
      game: null,
      version: 0,
      selectedCard: null,
      asyncSelected: {},
    });
    const socket = getSocket();
    // Reconecta si ya había una conexión: Socket.IO no abandona rooms anteriores por sí solo, y
    // un socket que arrastrara la room de otra partida seguiría recibiendo sus eventos. Si el
    // socket no se ha conectado nunca, desconectar antes de conectar solo añade un intento fallido.
    if (socket.connected) socket.disconnect();
    socket.connect();
  },

  clearError() {
    set({ errorMessage: null });
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

  startQuickRound() {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    set({ selectedCard: null });
    getSocket().emit('start_quick_round', { gameId, participantId });
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

  setFinalEstimate(card, issueId) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('set_estimate', {
      gameId,
      participantId,
      card,
      ...(issueId !== undefined ? { issueId } : {}),
    });
  },

  openAsyncRounds(issueIds) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('open_async_rounds', { gameId, participantId, issueIds });
  },

  castAsyncVote(issueId, card) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    set((state) => ({ asyncSelected: { ...state.asyncSelected, [issueId]: card } }));
    getSocket().emit('async_vote', { gameId, participantId, issueId, card });
  },

  revealAsync(issueIds) {
    const { gameId, participantId } = get();
    if (!gameId || !participantId) return;
    getSocket().emit('reveal_async', {
      gameId,
      participantId,
      ...(issueIds !== undefined ? { issueIds } : {}),
    });
  },

  renameIssue(issueId, title) {
    const trimmed = title.trim();
    return changeIssues(
      (issues) =>
        issues.map((issue) => (issue.id === issueId ? { ...issue, title: trimmed } : issue)),
      (gameId, participantId) => editIssue(gameId, issueId, { participantId, title: trimmed }),
      'No se pudo renombrar la tarea.',
    );
  },

  deleteIssue(issueId) {
    return changeIssues(
      (issues) => issues.filter((issue) => issue.id !== issueId),
      (gameId, participantId) => removeIssue(gameId, issueId, { participantId }),
      'No se pudo borrar la tarea.',
    );
  },

  reorderIssueQueue(issueIds) {
    return changeIssues(
      (issues) => {
        const byId = new Map(issues.map((issue) => [issue.id, issue]));
        return issueIds.flatMap((id) => byId.get(id) ?? []);
      },
      (gameId, participantId) => reorderIssues(gameId, { participantId, issueIds: [...issueIds] }),
      'No se pudo reordenar las tareas.',
    );
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

/**
 * Pinta `patch` sobre la cola de tareas antes de que conteste la API. Si la API falla, deshace el
 * cambio solo si nadie más ha tocado la cola mientras tanto (si lo hizo, el servidor ya manda) y
 * pide un `state_sync`: un 422 por un orden obsoleto significa que este cliente iba desfasado.
 */
async function changeIssues(
  patch: (issues: ReadonlyArray<IssueView>) => ReadonlyArray<IssueView>,
  request: (gameId: string, participantId: string) => Promise<void>,
  fallbackMessage: string,
): Promise<void> {
  const { game, gameId, participantId } = useGameStore.getState();
  if (!game || !gameId || !participantId) return;

  const previous = game.issues;
  const optimistic = patch(previous);
  useGameStore.setState({ game: { ...game, issues: optimistic } });

  try {
    await request(gameId, participantId);
  } catch (cause) {
    const current = useGameStore.getState().game;
    useGameStore.setState({
      ...(current?.issues === optimistic ? { game: { ...current, issues: previous } } : {}),
      errorMessage: messageOf(cause, fallbackMessage),
    });
    const socket = getSocket();
    if (socket.connected) socket.emit('join', { gameId, participantId });
  }
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function currentRoundId(game: GameView | null): string | null {
  return game?.currentRound?.id ?? null;
}

function applyEvent(event: ServerEvent): void {
  const { game, gameId, participantId, version } = useGameStore.getState();

  // El servidor no garantiza orden de entrega entre sockets/peticiones HTTP concurrentes (p. ej.
  // dos guardados de ajustes solapados): un evento con versión igual o anterior a la ya aplicada
  // es un duplicado o llegó desordenado, y aplicarlo igualmente revertiría el estado a algo más
  // viejo (síntoma: ajustes/reacciones que "desaparecen" tras guardar). `state_sync` queda fuera:
  // es una foto completa, no un parche, y el contador del servidor vive en memoria — una partida
  // nueva o una API recién reiniciada responde con versión 0, que `connect()` ya dejó como actual.
  if (event.type !== 'state_sync' && event.version <= version) return;

  const next = gameEventsReducer(game, event);
  // Abrir ronda nueva invalida el voto optimista en TODOS los clientes, no solo en el que pulsó
  // "volver a votar": el resto solo se entera de la ronda nueva por este evento.
  const roundChanged = currentRoundId(next) !== currentRoundId(game);
  useGameStore.setState({
    game: next,
    version: event.version,
    // Una carta elegida de la baraja anterior no tiene por qué existir en la nueva.
    ...(roundChanged || event.type === 'deck_changed' ? { selectedCard: null } : {}),
    // Una foto completa trae ya los votos propios confirmados, y una baraja nueva invalida los elegidos.
    ...(event.type === 'state_sync' || event.type === 'deck_changed' ? { asyncSelected: {} } : {}),
  });

  if (event.type === 'participant_left' && event.participantId === participantId) {
    useGameStore.setState({ hasLeft: true });
    return;
  }

  if (needsResync(event.type) && gameId && participantId) {
    getSocket().emit('join', { gameId, participantId });
  }
}

// Los listeners se registran una única vez a nivel de módulo: `getSocket()` devuelve el mismo
// socket durante toda la vida de la app, y volver a registrarlos en cada `connect()` los apilaría.
const socket = getSocket();

// Cada conexión, también las reconexiones automáticas de Socket.IO, es un socket nuevo en el
// servidor y sin rooms: sin volver a emitir `join` aquí, tras un corte o un reinicio de la API el
// cliente deja de recibir eventos y la mesa se queda congelada aunque los cambios sí se guarden.
socket.on('connect', () => {
  useGameStore.setState({ status: 'connected' });
  const { gameId, participantId } = useGameStore.getState();
  if (gameId && participantId) socket.emit('join', { gameId, participantId });
});
socket.on('disconnect', () => {
  useGameStore.setState({ status: 'disconnected' });
});
socket.on('error', (event: { message: string }) => {
  const { asyncSelected, gameId, participantId } = useGameStore.getState();
  useGameStore.setState({ errorMessage: event.message });
  // El servidor no dice qué comando rechazó. Si hay votos en diferido pintados sin confirmar, uno
  // puede haber sido el rechazado: se pide la foto real, que además los reemplaza por los confirmados.
  if (Object.keys(asyncSelected).length > 0 && gameId && participantId) {
    socket.emit('join', { gameId, participantId });
  }
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
socket.on(
  'participant_hat_changed',
  (event: Extract<ServerEvent, { type: 'participant_hat_changed' }>) => {
    applyEvent(event);
  },
);
socket.on('facilitator_changed', (event: Extract<ServerEvent, { type: 'facilitator_changed' }>) => {
  applyEvent(event);
});
socket.on('issue_added', (event: Extract<ServerEvent, { type: 'issue_added' }>) => {
  applyEvent(event);
});
socket.on('issues_imported', (event: Extract<ServerEvent, { type: 'issues_imported' }>) => {
  applyEvent(event);
});
socket.on('issue_edited', (event: Extract<ServerEvent, { type: 'issue_edited' }>) => {
  applyEvent(event);
});
socket.on('issue_removed', (event: Extract<ServerEvent, { type: 'issue_removed' }>) => {
  applyEvent(event);
});
socket.on('issues_reordered', (event: Extract<ServerEvent, { type: 'issues_reordered' }>) => {
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
socket.on('async_rounds_opened', (event: Extract<ServerEvent, { type: 'async_rounds_opened' }>) => {
  applyEvent(event);
});
socket.on('async_vote_cast', (event: Extract<ServerEvent, { type: 'async_vote_cast' }>) => {
  applyEvent(event);
});
socket.on(
  'async_rounds_revealed',
  (event: Extract<ServerEvent, { type: 'async_rounds_revealed' }>) => {
    applyEvent(event);
  },
);
socket.on('issue_estimated', (event: Extract<ServerEvent, { type: 'issue_estimated' }>) => {
  applyEvent(event);
});
socket.on('settings_changed', (event: Extract<ServerEvent, { type: 'settings_changed' }>) => {
  applyEvent(event);
});
socket.on('deck_changed', (event: Extract<ServerEvent, { type: 'deck_changed' }>) => {
  applyEvent(event);
});
socket.on('participant_left', (event: Extract<ServerEvent, { type: 'participant_left' }>) => {
  applyEvent(event);
});

// Presencia y salida propia son `EphemeralEvent`: no llevan `version` ni pasan por el reductor
// (docs/adr/0015-presencia-y-salida-de-participantes.md).
socket.on('presence_changed', (event: Extract<EphemeralEvent, { type: 'presence_changed' }>) => {
  useGameStore.setState((state) =>
    state.game
      ? {
          game: {
            ...state.game,
            participants: state.game.participants.map((participant) =>
              participant.id === event.participantId
                ? { ...participant, online: event.online }
                : participant,
            ),
          },
        }
      : {},
  );
});
socket.on('left_game', () => {
  useGameStore.setState({ hasLeft: true });
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
// El servidor ya ha sacado al socket de la room: sin `game`, la mesa muestra el mensaje y la salida.
socket.on('game_closed', () => {
  useGameStore.setState({
    game: null,
    selectedCard: null,
    discussionTimer: null,
    errorMessage: 'Esta sala ya no existe: la ha cerrado un administrador.',
  });
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
