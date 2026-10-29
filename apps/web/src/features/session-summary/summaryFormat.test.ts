import type { GameSummaryIssueView } from '@pp/contracts';
import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatNonNumericEstimates,
  formatPoints,
  needsAttention,
} from './summaryFormat.js';

function issue(overrides: Partial<GameSummaryIssueView> = {}): GameSummaryIssueView {
  return {
    id: 'issue-1',
    title: 'Login',
    description: null,
    externalUrl: null,
    status: 'ESTIMATED',
    finalEstimate: '5',
    rounds: 1,
    agreementPercentage: 100,
    average: 5,
    durationMs: 60_000,
    ...overrides,
  };
}

describe('formatDuration', () => {
  it('muestra un guion cuando no hay tiempos', () => {
    expect(formatDuration(null)).toBe('—');
  });

  it('usa segundos por debajo del minuto, minutos por debajo de la hora y horas a partir de ahí', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(180_000)).toBe('3 min');
    expect(formatDuration(3_600_000)).toBe('1 h');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
  });
});

describe('formatPoints', () => {
  it('quita los decimales sobrantes de una suma con medios puntos', () => {
    expect(formatPoints(8)).toBe('8');
    expect(formatPoints(8.5)).toBe('8.5');
    expect(formatPoints(0.1 + 0.2)).toBe('0.3');
  });
});

describe('formatNonNumericEstimates', () => {
  it('lista cada valor con su recuento', () => {
    expect(formatNonNumericEstimates({ M: 2, L: 1 })).toBe('M ×2 · L ×1');
    expect(formatNonNumericEstimates({})).toBe('');
  });
});

describe('needsAttention', () => {
  it('no señala una tarea con acuerdo y una sola ronda', () => {
    expect(needsAttention(issue())).toBe(false);
  });

  it('señala una tarea con un acuerdo por debajo del 50 %', () => {
    expect(needsAttention(issue({ agreementPercentage: 49 }))).toBe(true);
    expect(needsAttention(issue({ agreementPercentage: 50 }))).toBe(false);
  });

  it('señala una tarea que necesitó varias rondas aunque acabara en acuerdo', () => {
    expect(needsAttention(issue({ rounds: 2 }))).toBe(true);
  });

  it('no señala una tarea que aún no se ha votado', () => {
    expect(
      needsAttention(
        issue({ status: 'PENDING', rounds: 0, agreementPercentage: null, finalEstimate: null }),
      ),
    ).toBe(false);
  });
});
