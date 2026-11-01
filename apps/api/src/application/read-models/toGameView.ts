import type {
  AsyncRoundView,
  GameView,
  IssueView,
  ParticipantView,
  PastRoundView,
  RoundResultView,
  RoundView,
} from '@pp/contracts';
import type { Game } from '../../domain/game/Game.js';
import type { Issue } from '../../domain/game/Issue.js';
import type { ParticipantId } from '../../domain/game/ids.js';
import type { Participant } from '../../domain/game/Participant.js';
import type { Round } from '../../domain/game/Round.js';
import type { RoundResult } from '../../domain/game/RoundResult.js';

/**
 * El único punto por el que un voto puede salir del servidor hacia un participante concreto
 * (invariante 7, docs/02-decisiones-y-plan.md §4.3): antes del reveal, `votes` solo lleva el
 * propio voto de `viewerId` en claro; el resto aparece solo como `hasVoted: true`, sin `card`.
 */
export function toGameView(
  game: Game,
  viewerId: ParticipantId,
  online: ReadonlyArray<ParticipantId> = [],
): GameView {
  const round = game.currentRound();
  const settings = game.currentSettings();
  const dealerId = game.currentDealer();

  return {
    id: game.id.value,
    name: game.currentName().value,
    deck: {
      cards: game
        .currentDeck()
        .values()
        .map((card) => card.raw),
    },
    settings: {
      autoReveal: settings.autoReveal,
      whoCanReveal: settings.whoCanReveal,
      namedRevealers: settings.namedRevealers.map((id) => id.value),
      allowVoteChange: settings.allowVoteChange,
      celebrate: settings.celebrate,
      throwEmojis: settings.throwEmojis,
      countdownSeconds: settings.countdownSeconds,
      revealOnTimeout: settings.revealOnTimeout,
    },
    participants: game
      .allParticipants()
      .filter((participant) => !participant.hasLeft())
      .map((participant) =>
        toParticipantView(
          participant,
          online.some((id) => id.equals(participant.id)),
        ),
      ),
    issues: game.allIssues().map(toIssueView),
    currentRound: round
      ? toRoundView(round, viewerId, dealerId, previousRoundsOf(game, round))
      : null,
    asyncRounds: game
      .activeAsyncRounds()
      .map((asyncRound) => toAsyncRoundView(asyncRound, viewerId)),
  };
}

function toParticipantView(participant: Participant, online: boolean): ParticipantView {
  return {
    id: participant.id.value,
    displayName: participant.displayName.value,
    role: participant.currentRole(),
    isFacilitator: participant.isFacilitator,
    online,
    hat: participant.currentHat()?.id ?? null,
  };
}

export function toIssueView(issue: Issue): IssueView {
  return {
    id: issue.id.value,
    title: issue.title,
    description: nullIfBlank(issue.description),
    externalUrl: nullIfBlank(issue.externalUrl),
    status: issue.currentStatus(),
    finalEstimate: issue.currentFinalEstimate()?.raw ?? null,
  };
}

/** Una descripción vacía es la forma de borrarla al editar (ADR 0019): para la vista es «sin descripción». */
function nullIfBlank(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

/**
 * Segunda vía por la que un voto puede salir del servidor (ADR 0020): se filtra por `isRevealed()`
 * antes de leer ninguno y `revealedVotes()` lo vuelve a exigir, así que una ronda abierta nunca
 * llega a `toPastRoundView` ni siquiera si un día `roundsOf` devolviera algo de más.
 */
function previousRoundsOf(game: Game, current: Round): PastRoundView[] {
  return game
    .roundsOf(current.issueId)
    .filter((round) => round.roundNumber < current.roundNumber && round.isRevealed())
    .map(toPastRoundView);
}

function toPastRoundView(round: Round): PastRoundView {
  return {
    id: round.id.value,
    roundNumber: round.roundNumber,
    votes: round
      .revealedVotes()
      .map((vote) => ({ participantId: vote.participantId.value, card: vote.card.raw })),
    result: toRoundResultView(round.revealedResult()),
  };
}

function toRoundView(
  round: Round,
  viewerId: ParticipantId,
  dealerId: ParticipantId | null,
  previousRounds: PastRoundView[],
): RoundView {
  const revealed = round.isRevealed();

  return {
    id: round.id.value,
    issueId: round.issueId.value,
    roundNumber: round.roundNumber,
    status: round.currentStatus(),
    votes: round.allVotesRaw().map((vote) => ({
      participantId: vote.participantId.value,
      card: revealed || vote.participantId.equals(viewerId) ? vote.card.raw : null,
      hasVoted: true,
    })),
    result: revealed ? toRoundResultView(round.revealedResult()) : null,
    previousRounds,
    dealerId: dealerId?.value ?? null,
    timerDeadline: round.currentTimerDeadline()?.toISOString() ?? null,
  };
}

/**
 * Tercera vía por la que un voto puede salir del servidor (ADR 0027), con la misma regla que
 * `toRoundView`: abierta, solo quién ha votado y la carta del propio viewer; las cartas de los demás
 * y el resultado únicamente cuando la ronda está revelada.
 */
function toAsyncRoundView(round: Round, viewerId: ParticipantId): AsyncRoundView {
  const revealed = round.isRevealed();
  const votes = round.allVotesRaw();

  return {
    roundId: round.id.value,
    issueId: round.issueId.value,
    status: round.currentStatus(),
    voterIds: votes.map((vote) => vote.participantId.value),
    ownCard: votes.find((vote) => vote.participantId.equals(viewerId))?.card.raw ?? null,
    votes: revealed
      ? round
          .revealedVotes()
          .map((vote) => ({ participantId: vote.participantId.value, card: vote.card.raw }))
      : [],
    result: revealed ? toRoundResultView(round.revealedResult()) : null,
  };
}

export function toRoundResultView(result: RoundResult): RoundResultView {
  return {
    distribution: Object.fromEntries(result.distribution),
    average: result.average,
    agreementPercentage: result.agreementPercentage,
    mostVoted: result.mostVoted?.raw ?? null,
    isUnanimous: result.isUnanimous,
  };
}
