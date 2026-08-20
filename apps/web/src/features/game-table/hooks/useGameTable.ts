import type { GameView, ParticipantView, RoundView } from '@pp/contracts';
import { useEffect } from 'react';
import { useGameStore } from '../../../shared/store/gameStore.js';
import type { ConnectionStatus } from '../../../shared/store/gameStore.js';
import type { SeatPosition } from '../seatLayout.js';
import { orderSeatsWithViewerAt } from '../seatLayout.js';
import { useCountdown } from './useCountdown.js';

export interface UseGameTableResult {
  readonly game: GameView | null;
  readonly status: ConnectionStatus;
  readonly errorMessage: string | null;
  readonly round: RoundView | null;
  readonly seats: ReadonlyArray<ParticipantView & { readonly seat: SeatPosition }>;
  readonly spectators: ReadonlyArray<ParticipantView>;
  readonly votedCount: number;
  readonly totalVoters: number;
  readonly selectedCard: string | null;
  readonly castVote: (card: string) => void;
  readonly startRound: (issueId: string) => void;
  readonly reveal: () => void;
  readonly remainingMs: number | null;
  readonly theme: 'dark' | 'light';
  readonly muted: boolean;
  readonly toggleTheme: () => void;
  readonly toggleMuted: () => void;
  readonly canReveal: boolean;
  readonly clearError: () => void;
}

export function useGameTable(gameId: string, participantId: string): UseGameTableResult {
  const connect = useGameStore((state) => state.connect);
  const game = useGameStore((state) => state.game);
  const status = useGameStore((state) => state.status);
  const errorMessage = useGameStore((state) => state.errorMessage);
  const clearError = useGameStore((state) => state.clearError);
  const optimisticCard = useGameStore((state) => state.selectedCard);
  const castVote = useGameStore((state) => state.castVote);
  const startRound = useGameStore((state) => state.startRound);
  const reveal = useGameStore((state) => state.reveal);
  const timeoutReveal = useGameStore((state) => state.timeoutReveal);
  const theme = useGameStore((state) => state.theme);
  const muted = useGameStore((state) => state.muted);
  const toggleTheme = useGameStore((state) => state.toggleTheme);
  const toggleMuted = useGameStore((state) => state.toggleMuted);

  useEffect(() => {
    connect(gameId, participantId);
  }, [connect, gameId, participantId]);

  const round = game?.currentRound ?? null;
  const remainingMs = useCountdown(round?.timerDeadline ?? null);

  useEffect(() => {
    if (remainingMs === 0 && round?.status === 'OPEN' && game?.settings.revealOnTimeout) {
      timeoutReveal();
    }
  }, [remainingMs, round?.status, game?.settings.revealOnTimeout, timeoutReveal]);

  const voters = game?.participants.filter((participant) => participant.role === 'VOTER') ?? [];
  const spectators =
    game?.participants.filter((participant) => participant.role === 'SPECTATOR') ?? [];
  const seats = orderSeatsWithViewerAt(voters, participantId);
  const votedCount = round?.votes.length ?? 0;
  // La proyección devuelve la carta del propio viewer en claro, así que al recargar la página se
  // recupera el voto. Manda el valor optimista mientras exista: es más reciente que la última
  // confirmación, y `participant_voted` no reenvía la carta al cambiar de voto.
  const confirmedCard =
    round?.votes.find((vote) => vote.participantId === participantId)?.card ?? null;

  return {
    game,
    status,
    errorMessage,
    round,
    seats,
    spectators,
    votedCount,
    totalVoters: voters.length,
    selectedCard: optimisticCard ?? confirmedCard,
    castVote,
    startRound,
    reveal,
    remainingMs,
    theme,
    muted,
    toggleTheme,
    toggleMuted,
    canReveal: game ? canParticipantReveal(game, participantId) : false,
    clearError,
  };
}

function canParticipantReveal(game: GameView, participantId: string): boolean {
  const me = game.participants.find((participant) => participant.id === participantId);
  if (!me) return false;
  switch (game.settings.whoCanReveal) {
    case 'FACILITATOR_ONLY':
      return me.isFacilitator;
    case 'ANYONE':
      return true;
    case 'DEALER':
      return game.currentRound?.dealerId === participantId;
    case 'NAMED_LIST':
      return game.settings.namedRevealers.includes(participantId);
  }
}
