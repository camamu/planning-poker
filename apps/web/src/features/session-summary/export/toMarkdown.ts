import type { GameSummaryIssueView, GameSummaryTotalsView, GameSummaryView } from '@pp/contracts';
import { formatNonNumericEstimates, formatPoints, ISSUE_STATUS_LABELS } from '../summaryFormat.js';

/**
 * Tabla Markdown del resumen (ADR 0026), pensada para pegar en Confluence, Notion o una PR: tarea
 * (enlazada si tiene URL), estimación, rondas y acuerdo, y una línea de totales debajo.
 */
export function toMarkdown(summary: GameSummaryView): string {
  return [
    '| Tarea | Estimación | Rondas | Acuerdo |',
    '| --- | :---: | ---: | ---: |',
    ...summary.issues.map(rowOf),
    '',
    totalsLine(summary.totals),
    '',
  ].join('\n');
}

function rowOf(issue: GameSummaryIssueView): string {
  const estimate =
    issue.status === 'ESTIMATED'
      ? escape(issue.finalEstimate ?? '—')
      : ISSUE_STATUS_LABELS[issue.status];
  const agreement =
    issue.agreementPercentage === null ? '—' : `${issue.agreementPercentage.toString()}%`;
  return `| ${titleCell(issue)} | ${estimate} | ${issue.rounds.toString()} | ${agreement} |`;
}

function titleCell(issue: GameSummaryIssueView): string {
  const title = escape(issue.title);
  return issue.externalUrl === null ? title : `[${title}](${escapeUrl(issue.externalUrl)})`;
}

/** Un `|` sin escapar partiría la fila; el resto evita que un título se renderice como formato. */
function escape(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[\\|[\]*_`<>&]/g, '\\$&');
}

/** Los paréntesis y las barras verticales de una URL cerrarían el enlace o la celda. */
function escapeUrl(url: string): string {
  return url.replace(
    /[()|\s<>]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );
}

function totalsLine(totals: GameSummaryTotalsView): string {
  const total = totals.estimatedCount + totals.pendingCount;
  const sizes = formatNonNumericEstimates(totals.nonNumericEstimates);
  const parts = [`${totals.estimatedCount.toString()} / ${total.toString()} tareas estimadas`];
  if (totals.points !== null) parts.push(`${formatPoints(totals.points)} puntos`);
  if (sizes !== '') parts.push(sizes);
  if (totals.pendingCount > 0) parts.push(`${totals.pendingCount.toString()} sin estimar`);
  return `**Total:** ${parts.join(' · ')}`;
}
