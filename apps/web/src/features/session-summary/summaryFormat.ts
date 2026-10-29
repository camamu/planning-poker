import type { GameSummaryIssueView, GameSummaryTotalsView } from '@pp/contracts';

/** Por debajo de este acuerdo en la última ronda, la tarea se señala como sin consenso. */
export const LOW_AGREEMENT_THRESHOLD = 50;

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds.toString()} s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes.toString()} min`;
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60).toString();
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes.toString()} min`;
}

/** Las cartas con decimales (0.5) suman decimales que no merece la pena enseñar. */
export function formatPoints(points: number): string {
  return Number(points.toFixed(2)).toString();
}

export interface AttentionFlags {
  readonly lowAgreement: boolean;
  readonly multipleRounds: boolean;
}

export function attentionOf(issue: GameSummaryIssueView): AttentionFlags {
  return {
    lowAgreement:
      issue.agreementPercentage !== null && issue.agreementPercentage < LOW_AGREEMENT_THRESHOLD,
    multipleRounds: issue.rounds > 1,
  };
}

export function needsAttention(issue: GameSummaryIssueView): boolean {
  const flags = attentionOf(issue);
  return flags.lowAgreement || flags.multipleRounds;
}

/** «M ×2 · L ×1», en el orden en que vienen del servidor. */
export function formatNonNumericEstimates(
  estimates: GameSummaryTotalsView['nonNumericEstimates'],
): string {
  return Object.entries(estimates)
    .map(([value, count]) => `${value} ×${count.toString()}`)
    .join(' · ');
}
