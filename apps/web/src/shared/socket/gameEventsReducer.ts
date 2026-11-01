import type {
  AsyncRoundView,
  GameView,
  IssueView,
  RoundVoteView,
  ServerEvent,
} from '@pp/contracts';

/**
 * Espejo cliente de la invariante 7: nunca fabrica un valor de voto que el servidor no le haya
 * dado. Los eventos que no traen datos suficientes para parchear correctamente (`participant_
 * joined`, `participant_left`, `issue_added`, `issues_imported`, `round_started`, `async_rounds_opened`, `async_rounds_revealed` — ver `needsResync`) se ignoran aquí a propósito: es
 * responsabilidad de quien escucha el socket pedir un `state_sync` fresco para esos casos, no de
 * este reductor inventar un nombre, un título o un dealer que no le han llegado.
 */
export function gameEventsReducer(state: GameView | null, event: ServerEvent): GameView | null {
  switch (event.type) {
    case 'state_sync':
      return event.state;

    case 'participant_joined':
    case 'participant_left':
    case 'issue_added':
    case 'issues_imported':
    case 'round_started':
    case 'async_rounds_opened':
    case 'async_rounds_revealed':
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

    case 'participant_hat_changed':
      if (!state) return state;
      return {
        ...state,
        participants: state.participants.map((participant) =>
          participant.id === event.participantId ? { ...participant, hat: event.hat } : participant,
        ),
      };

    case 'facilitator_changed':
      if (!state) return state;
      return {
        ...state,
        participants: state.participants.map((participant) =>
          participant.id === event.previousId
            ? { ...participant, isFacilitator: false }
            : participant.id === event.nextId
              ? { ...participant, isFacilitator: true }
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

    // Solo la señal de que alguien votó: la carta no viaja (invariante 7), y la propia la pone el
    // store hasta el siguiente `state_sync`.
    case 'async_vote_cast':
      return patchAsyncRound(state, event.issueId, (round) => ({
        ...round,
        voterIds: round.voterIds.includes(event.participantId)
          ? round.voterIds
          : [...round.voterIds, event.participantId],
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
        // Estimar cierra la ronda en diferido de la tarea, si la tenía.
        asyncRounds: state.asyncRounds.filter((round) => round.issueId !== event.issueId),
      };

    case 'issue_edited':
      if (!state) return state;
      return {
        ...state,
        issues: state.issues.map((issue) => (issue.id === event.issue.id ? event.issue : issue)),
      };

    case 'issue_removed':
      if (!state) return state;
      return withDealer(
        { ...state, issues: state.issues.filter((issue) => issue.id !== event.issueId) },
        event.dealerId,
      );

    case 'issues_reordered':
      if (!state) return state;
      return withDealer(
        { ...state, issues: inOrder(state.issues, event.issueIds) },
        event.dealerId,
      );

    case 'settings_changed':
      if (!state) return state;
      return { ...state, settings: event.settings };

    case 'deck_changed':
      if (!state) return state;
      return { ...state, deck: event.deck };
  }
}

/** Tipos de evento que no traen datos suficientes para un parche correcto: hace falta resync. */
export function needsResync(eventType: ServerEvent['type']): boolean {
  return (
    eventType === 'participant_joined' ||
    eventType === 'participant_left' ||
    eventType === 'issue_added' ||
    eventType === 'issues_imported' ||
    eventType === 'round_started' ||
    eventType === 'async_rounds_opened' ||
    eventType === 'async_rounds_revealed'
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

function patchAsyncRound(
  state: GameView | null,
  issueId: string,
  patch: (round: AsyncRoundView) => AsyncRoundView,
): GameView | null {
  if (!state?.asyncRounds.some((round) => round.issueId === issueId)) return state;
  return {
    ...state,
    asyncRounds: state.asyncRounds.map((round) =>
      round.issueId === issueId ? patch(round) : round,
    ),
  };
}

/**
 * Borrar o reordenar tareas mueve la posición de la tarea actual en la cola, y con ella el dealer
 * (`Game.currentDealer()` en el servidor). El cliente no puede recalcularlo: el evento lo trae.
 */
function withDealer(state: GameView, dealerId: string | null): GameView {
  if (!state.currentRound) return state;
  return { ...state, currentRound: { ...state.currentRound, dealerId } };
}

/** Las tareas que el evento no nombra (no deberían existir) se quedan al final en vez de perderse. */
function inOrder(issues: ReadonlyArray<IssueView>, orderedIds: ReadonlyArray<string>): IssueView[] {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const ordered = orderedIds.flatMap((id) => byId.get(id) ?? []);
  const named = new Set(orderedIds);
  return [...ordered, ...issues.filter((issue) => !named.has(issue.id))];
}

function withVote(votes: ReadonlyArray<RoundVoteView>, participantId: string): RoundVoteView[] {
  if (votes.some((vote) => vote.participantId === participantId)) return [...votes];
  return [...votes, { participantId, card: null, hasVoted: true }];
}
