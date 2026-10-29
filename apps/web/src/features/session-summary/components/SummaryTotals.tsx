import type { GameSummaryTotalsView } from '@pp/contracts';
import type { JSX } from 'react';
import { formatDuration, formatNonNumericEstimates, formatPoints } from '../summaryFormat.js';

export interface SummaryTotalsProps {
  readonly totals: GameSummaryTotalsView;
}

function Stat({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string | undefined;
}): JSX.Element {
  return (
    <div
      className="rounded-[10px] p-3"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-divider)' }}
    >
      <div className="mb-1 text-[11px]" style={{ color: 'var(--pp-muted)' }}>
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
      {hint ? (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--pp-muted)' }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function estimatesStat(totals: GameSummaryTotalsView): { label: string; value: string } {
  const sizes = formatNonNumericEstimates(totals.nonNumericEstimates);
  if (totals.points !== null && sizes === '') {
    return { label: 'Puntos estimados', value: formatPoints(totals.points) };
  }
  if (totals.points === null && sizes !== '') return { label: 'Estimaciones', value: sizes };
  if (totals.points !== null) {
    return { label: 'Estimaciones', value: `${formatPoints(totals.points)} · ${sizes}` };
  }
  return { label: 'Puntos estimados', value: '—' };
}

export function SummaryTotals({ totals }: SummaryTotalsProps): JSX.Element {
  const total = totals.estimatedCount + totals.pendingCount;
  const estimates = estimatesStat(totals);

  return (
    <section aria-label="Totales de la sesión" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <Stat
        label="Tareas estimadas"
        value={`${totals.estimatedCount.toString()} / ${total.toString()}`}
        hint={totals.pendingCount > 0 ? `${totals.pendingCount.toString()} sin estimar` : undefined}
      />
      <Stat label={estimates.label} value={estimates.value} />
      <Stat
        label="Consenso total"
        value={totals.unanimousCount.toString()}
        hint="tareas estimadas por unanimidad"
      />
      <Stat
        label="Varias rondas"
        value={totals.multiRoundCount.toString()}
        hint="tareas que necesitaron repetir"
      />
      <Stat label="Duración media" value={formatDuration(totals.averageDurationMs)} />
      <Stat label="Votantes" value={totals.voterCount.toString()} />
    </section>
  );
}
