import type { GameView, HatIdView, ParticipantView, RoundView } from '@pp/contracts';
import { useEffect } from 'react';
import {
  changeParticipantHat,
  claimFacilitator,
  removeParticipant,
  transferFacilitator,
} from '../../../shared/api/gamesClient.js';
import { rememberGame } from '../../../shared/games/rememberedGames.js';
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
  readonly hasLeft: boolean;
  readonly isFacilitator: boolean;
  /** El facilitador está desconectado y quien mira puede tomar el relevo (ADR 0021). */
  readonly facilitatorAbsent: boolean;
  readonly facilitatorName: string | null;
  /** Solo el facilitador: pasa el rol a otro participante. */
  readonly transferFacilitator: (toParticipantId: string) => Promise<void>;
  /** Cualquiera: toma el relevo de un facilitador desconectado; el servidor lo comprueba. */
  readonly claimFacilitator: () => Promise<void>;
  /** El facilitador cede el rol y sale de la partida en un solo gesto. */
  readonly leaveAsFacilitator: (successorId: string) => Promise<void>;
  /** El facilitador quita a otro, o cualquiera sale él mismo (`targetId === participantId`). */
  readonly removeParticipant: (targetId: string) => Promise<void>;
  /** `null` = quitarse el sombrero. Solo el propio: nadie le pone sombrero a otro (ADR 0017). */
  readonly changeHat: (hat: HatIdView | null) => Promise<void>;
  readonly selectedCard: string | null;
  readonly castVote: (card: string) => void;
  readonly startRound: (issueId: string) => void;
  readonly startQuickRound: () => void;
  readonly reveal: () => void;
  readonly setFinalEstimate: (card: string) => void;
  readonly renameIssue: (issueId: string, title: string) => void;
  readonly deleteIssue: (issueId: string) => void;
  readonly reorderIssues: (issueIds: ReadonlyArray<string>) => void;
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
  const hasLeft = useGameStore((state) => state.hasLeft);
  const clearError = useGameStore((state) => state.clearError);
  const optimisticCard = useGameStore((state) => state.selectedCard);
  const castVote = useGameStore((state) => state.castVote);
  const startRound = useGameStore((state) => state.startRound);
  const startQuickRound = useGameStore((state) => state.startQuickRound);
  const reveal = useGameStore((state) => state.reveal);
  const setFinalEstimate = useGameStore((state) => state.setFinalEstimate);
  const timeoutReveal = useGameStore((state) => state.timeoutReveal);
  const renameIssue = useGameStore((state) => state.renameIssue);
  const deleteIssue = useGameStore((state) => state.deleteIssue);
  const reorderIssueQueue = useGameStore((state) => state.reorderIssueQueue);
  const theme = useGameStore((state) => state.theme);
  const muted = useGameStore((state) => state.muted);
  const toggleTheme = useGameStore((state) => state.toggleTheme);
  const toggleMuted = useGameStore((state) => state.toggleMuted);

  useEffect(() => {
    connect(gameId, participantId);
  }, [connect, gameId, participantId]);

  // `game` puede ser todavía el de otra sala hasta que llega el `state_sync` de esta.
  const loadedName = game?.id === gameId ? game.name : undefined;
  useEffect(() => {
    if (loadedName !== undefined) rememberGame({ id: gameId, name: loadedName });
  }, [gameId, loadedName]);

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
  // Los recuentos solo cuentan a quien está conectado (invariante 8): un fantasma no debe hacer
  // esperar a la mesa. Sus votos ya emitidos sí cuentan para el resultado, solo no para este "x de y".
  const presentVoters = voters.filter((participant) => participant.online);
  const votedCount =
    round?.votes.filter((vote) => presentVoters.some((voter) => voter.id === vote.participantId))
      .length ?? 0;
  // La proyección devuelve la carta del propio viewer en claro, así que al recargar la página se
  // recupera el voto. Manda el valor optimista mientras exista: es más reciente que la última
  // confirmación, y `participant_voted` no reenvía la carta al cambiar de voto.
  const confirmedCard =
    round?.votes.find((vote) => vote.participantId === participantId)?.card ?? null;
  const me = game?.participants.find((participant) => participant.id === participantId);
  const facilitator = game?.participants.find((participant) => participant.isFacilitator);

  return {
    game,
    status,
    errorMessage,
    round,
    seats,
    spectators,
    votedCount,
    totalVoters: presentVoters.length,
    hasLeft,
    isFacilitator: me?.isFacilitator ?? false,
    // Con el socket caído la presencia que se ve está obsoleta: no se ofrece un relevo que el
    // servidor rechazaría o, peor, que se pediría por un corte propio.
    facilitatorAbsent:
      status === 'connected' && !!me && !me.isFacilitator && !!facilitator && !facilitator.online,
    facilitatorName: facilitator?.displayName ?? null,
    transferFacilitator: async (toParticipantId) => {
      try {
        await transferFacilitator(gameId, { participantId, toParticipantId });
      } catch (cause) {
        reportFailure(cause, 'No se pudo ceder el rol de facilitador.');
      }
    },
    claimFacilitator: async () => {
      try {
        await claimFacilitator(gameId, { participantId });
      } catch (cause) {
        reportFailure(cause, 'No se pudo tomar el relevo.');
      }
    },
    leaveAsFacilitator: async (successorId) => {
      try {
        await transferFacilitator(gameId, { participantId, toParticipantId: successorId });
        await removeParticipant(gameId, participantId, participantId);
        useGameStore.setState({ hasLeft: true });
      } catch (cause) {
        reportFailure(cause, 'No se pudo ceder el rol y salir de la partida.');
      }
    },
    removeParticipant: async (targetId) => {
      try {
        await removeParticipant(gameId, targetId, participantId);
        if (targetId === participantId) useGameStore.setState({ hasLeft: true });
      } catch (cause) {
        useGameStore.setState({
          errorMessage: cause instanceof Error ? cause.message : 'No se pudo completar la acción.',
        });
      }
    },
    changeHat: async (hat) => {
      try {
        await changeParticipantHat(gameId, participantId, { participantId, hat });
      } catch (cause) {
        useGameStore.setState({
          errorMessage: cause instanceof Error ? cause.message : 'No se pudo cambiar el sombrero.',
        });
      }
    },
    selectedCard: optimisticCard ?? confirmedCard,
    castVote,
    startRound,
    startQuickRound,
    reveal,
    setFinalEstimate,
    renameIssue: (issueId, title) => void renameIssue(issueId, title),
    deleteIssue: (issueId) => void deleteIssue(issueId),
    reorderIssues: (issueIds) => void reorderIssueQueue(issueIds),
    remainingMs,
    theme,
    muted,
    toggleTheme,
    toggleMuted,
    canReveal: game ? canParticipantReveal(game, participantId) : false,
    clearError,
  };
}

function reportFailure(cause: unknown, fallback: string): void {
  useGameStore.setState({ errorMessage: cause instanceof Error ? cause.message : fallback });
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
