import type { GameSummaryIssueView, GameSummaryTotalsView, GameSummaryView } from '@pp/contracts';
import type { Game } from '../../domain/game/Game.js';
import type { Issue } from '../../domain/game/Issue.js';
import type { Round } from '../../domain/game/Round.js';
import { toIssueView } from './toGameView.js';

interface IssueFacts {
  readonly issue: Issue;
  readonly revealedRounds: ReadonlyArray<Round>;
  readonly durationMs: number | null;
}

/**
 * Proyección de cierre de la sesión (ADR 0025). Solo lee rondas reveladas y solo saca agregados:
 * los votos se recorren para contar votantes distintos, nunca para devolverlos, y una ronda
 * abierta no se toca (invariante 7).
 */
export function toGameSummaryView(game: Game): GameSummaryView {
  const facts = game.allIssues().map((issue) => factsOf(game, issue));

  return {
    id: game.id.value,
    name: game.currentName().value,
    issues: facts.map(toSummaryIssueView),
    totals: toTotals(facts),
  };
}

function factsOf(game: Game, issue: Issue): IssueFacts {
  const rounds = game.roundsOf(issue.id);
  return {
    issue,
    revealedRounds: rounds.filter((round) => round.isRevealed()),
    durationMs: durationOf(issue, rounds[0]),
  };
}

/** `null` si falta cualquiera de los dos tiempos: las partidas anteriores a la migración 0008 no los tienen. */
function durationOf(issue: Issue, firstRound: Round | undefined): number | null {
  const openedAt = firstRound?.currentOpenedAt();
  const estimatedAt = issue.currentEstimatedAt();
  if (!openedAt || !estimatedAt) return null;
  return estimatedAt.getTime() - openedAt.getTime();
}

function toSummaryIssueView(facts: IssueFacts): GameSummaryIssueView {
  const lastResult = facts.revealedRounds.at(-1)?.revealedResult() ?? null;
  return {
    ...toIssueView(facts.issue),
    rounds: facts.revealedRounds.length,
    agreementPercentage: lastResult?.agreementPercentage ?? null,
    average: lastResult?.average ?? null,
    durationMs: facts.durationMs,
  };
}

function toTotals(facts: ReadonlyArray<IssueFacts>): GameSummaryTotalsView {
  const estimated = facts.filter(({ issue }) => issue.currentStatus() === 'ESTIMATED');
  const durations = facts
    .map(({ durationMs }) => durationMs)
    .filter((duration): duration is number => duration !== null);

  return {
    estimatedCount: estimated.length,
    pendingCount: facts.length - estimated.length,
    ...estimateTotals(estimated),
    unanimousCount: estimated.filter(
      ({ revealedRounds }) => revealedRounds.at(-1)?.revealedResult().isUnanimous === true,
    ).length,
    multiRoundCount: facts.filter(({ revealedRounds }) => revealedRounds.length > 1).length,
    averageDurationMs:
      durations.length === 0
        ? null
        : Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length),
    voterCount: distinctVoters(facts),
  };
}

/**
 * Por valor de la estimación y no por baraja: la baraja se puede cambiar en sala (ADR 0014), así
 * que una misma partida puede tener estimaciones de las dos clases. `?` y `☕` no cuentan en
 * ninguna.
 */
function estimateTotals(
  estimated: ReadonlyArray<IssueFacts>,
): Pick<GameSummaryTotalsView, 'points' | 'nonNumericEstimates'> {
  let points: number | null = null;
  const nonNumeric = new Map<string, number>();

  for (const { issue } of estimated) {
    const card = issue.currentFinalEstimate();
    if (card === null || card.special) continue;
    if (card.numeric !== null) {
      points = (points ?? 0) + card.numeric;
    } else {
      nonNumeric.set(card.raw, (nonNumeric.get(card.raw) ?? 0) + 1);
    }
  }

  return { points, nonNumericEstimates: Object.fromEntries(nonNumeric) };
}

function distinctVoters(facts: ReadonlyArray<IssueFacts>): number {
  const voters = new Set<string>();
  for (const { revealedRounds } of facts) {
    for (const round of revealedRounds) {
      for (const vote of round.revealedVotes()) voters.add(vote.participantId.value);
    }
  }
  return voters.size;
}
