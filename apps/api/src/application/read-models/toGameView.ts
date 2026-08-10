import type {
  GameView,
  IssueView,
  ParticipantView,
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
export function toGameView(game: Game, viewerId: ParticipantId): GameView {
  const round = game.currentRound();
  const settings = game.currentSettings();

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
    },
    participants: game.allParticipants().map(toParticipantView),
    issues: game.allIssues().map(toIssueView),
    currentRound: round ? toRoundView(round, viewerId) : null,
  };
}

function toParticipantView(participant: Participant): ParticipantView {
  return {
    id: participant.id.value,
    displayName: participant.displayName.value,
    role: participant.currentRole(),
    isFacilitator: participant.isFacilitator,
  };
}

function toIssueView(issue: Issue): IssueView {
  return {
    id: issue.id.value,
    title: issue.title,
    status: issue.currentStatus(),
    finalEstimate: issue.currentFinalEstimate()?.raw ?? null,
  };
}

function toRoundView(round: Round, viewerId: ParticipantId): RoundView {
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
