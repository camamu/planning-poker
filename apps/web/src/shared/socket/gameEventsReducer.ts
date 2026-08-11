import type { GameView, RoundVoteView, ServerEvent } from '@pp/contracts';

/**
 * Espejo cliente de la invariante 7: nunca fabrica un valor de voto que el servidor no le haya
 * dado. Los eventos que no traen datos suficientes para parchear correctamente (`participant_
 * joined`, `issue_added`, `round_started` — ver `NEEDS_RESYNC`) se ignoran aquí a propósito: es
 * responsabilidad de quien escucha el socket pedir un `state_sync` fresco para esos casos, no de
 * este reductor inventar un nombre, un título o un dealer que no le han llegado.
 */
export function gameEventsReducer(state: GameView | null, event: ServerEvent): GameView | null {
  switch (event.type) {
    case 'state_sync':
      return event.state;

    case 'participant_joined':
    case 'issue_added':
    case 'round_started':
      return state;

    case 'participant_role_changed':
      if (!state) return state;
      return {
        ...state,
        participants: state.participants.map((participant) =>
          participant.id === event.participantId
            ? { ...participant, role: event.role }
            : participant,
        ),
      };

    case 'participant_voted':
      return patchRound(state, event.roundId, (round) => ({
        ...round,
        votes: withVote(round.votes, event.participantId),
      }));

    case 'vote_retracted':
      return patchRound(state, event.roundId, (round) => ({
        ...round,
        votes: round.votes.filter((vote) => vote.participantId !== event.participantId),
      }));

    case 'round_revealed':
      return patchRound(state, event.roundId, (round) => ({
        ...round,
        status: 'REVEALED',
        votes: event.votes.map((vote) => ({ ...vote, hasVoted: true as const })),
        result: event.result,
      }));

    case 'issue_estimated':
      if (!state) return state;
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === event.issueId
            ? { ...issue, status: 'ESTIMATED', finalEstimate: event.finalEstimate }
            : issue,
        ),
      };

    case 'settings_changed':
      if (!state) return state;
      return { ...state, settings: event.settings };
  }
}

/** Tipos de evento que no traen datos suficientes para un parche correcto: hace falta resync. */
export function needsResync(eventType: ServerEvent['type']): boolean {
  return (
    eventType === 'participant_joined' ||
    eventType === 'issue_added' ||
    eventType === 'round_started'
  );
}

function patchRound(
  state: GameView | null,
  roundId: string,
  patch: (round: NonNullable<GameView['currentRound']>) => NonNullable<GameView['currentRound']>,
): GameView | null {
  if (!state?.currentRound || state.currentRound.id !== roundId) return state;
  return { ...state, currentRound: patch(state.currentRound) };
}

function withVote(votes: ReadonlyArray<RoundVoteView>, participantId: string): RoundVoteView[] {
  if (votes.some((vote) => vote.participantId === participantId)) return [...votes];
  return [...votes, { participantId, card: null, hasVoted: true }];
}
