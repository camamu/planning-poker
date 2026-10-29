import type { GameSummaryIssueView, IssueStatusView } from '@pp/contracts';
import type { JSX } from 'react';
import { attentionOf, formatDuration, needsAttention } from '../summaryFormat.js';

export interface SummaryTableProps {
  readonly issues: ReadonlyArray<GameSummaryIssueView>;
}

const STATUS_LABELS: Record<IssueStatusView, string> = {
  PENDING: 'Pendiente',
  VOTING: 'En votación',
  ESTIMATED: 'Estimada',
};

function TitleCell({ issue }: { readonly issue: GameSummaryIssueView }): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {issue.externalUrl ? (
        <a
          href={issue.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-medium underline"
        >
          {issue.title}
        </a>
      ) : (
        <span className="truncate font-medium">{issue.title}</span>
      )}
      {issue.description ? (
        <span className="truncate text-xs" style={{ color: 'var(--pp-muted)' }}>
          {issue.description}
        </span>
      ) : null}
    </div>
  );
}

function AttentionTags({ issue }: { readonly issue: GameSummaryIssueView }): JSX.Element | null {
  const flags = attentionOf(issue);
  if (!flags.lowAgreement && !flags.multipleRounds) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.lowAgreement ? <span className="tag tag-accent">Sin consenso</span> : null}
      {flags.multipleRounds ? (
        <span className="tag tag-outline">{issue.rounds.toString()} rondas</span>
      ) : null}
    </span>
  );
}

function SummaryRow({ issue }: { readonly issue: GameSummaryIssueView }): JSX.Element {
  const estimated = issue.status === 'ESTIMATED';
  const highlighted = needsAttention(issue);

  return (
    <tr
      className="align-top"
      data-attention={highlighted ? 'true' : undefined}
      style={{
        borderBottom: '1px solid var(--color-divider)',
        background: highlighted ? 'rgba(145,132,217,.10)' : undefined,
      }}
    >
      <td className="max-w-[320px] py-2.5 pr-3 pl-3">
        <TitleCell issue={issue} />
        <AttentionTags issue={issue} />
      </td>
      <td className="px-3 py-2.5 font-mono font-semibold">
        {estimated ? (
          (issue.finalEstimate ?? '—')
        ) : (
          <span className="text-xs font-normal" style={{ color: 'var(--pp-muted)' }}>
            {STATUS_LABELS[issue.status]}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-mono">{issue.rounds}</td>
      <td className="px-3 py-2.5 text-right font-mono">
        {issue.agreementPercentage === null ? '—' : `${issue.agreementPercentage.toString()}%`}
      </td>
      <td className="px-3 py-2.5 text-right font-mono">{formatDuration(issue.durationMs)}</td>
    </tr>
  );
}

export function SummaryTable({ issues }: SummaryTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-[10px]" style={{ border: '1px solid var(--pp-line)' }}>
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">Resultado de cada tarea de la sesión</caption>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
            <th scope="col" className="py-2 pr-3 pl-3 text-left">
              <span className="pp-kicker">Tarea</span>
            </th>
            <th scope="col" className="px-3 py-2 text-left">
              <span className="pp-kicker">Estimación</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="pp-kicker">Rondas</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="pp-kicker">Acuerdo</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="pp-kicker">Duración</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <SummaryRow key={issue.id} issue={issue} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
