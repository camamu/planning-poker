import { issueKeyFromUrl } from '@pp/contracts';
import type { GameSummaryIssueView, GameSummaryView } from '@pp/contracts';

export type CsvSeparator = ';' | ',';

export interface CsvOptions {
  readonly separator?: CsvSeparator;
}

const BOM = '\uFEFF';
const LINE_BREAK = '\r\n';

/** Las cinco primeras las reconoce `parseIssueInput` (ADR 0023): el CSV se puede importar tal cual. */
const HEADER = ['summary', 'key', 'description', 'link', 'estimate', 'rounds', 'agreement'];

/** Excel y Calc ejecutan como fórmula una celda de texto que empieza por alguno de estos caracteres. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * CSV del resumen (ADR 0026). `;` por defecto porque Excel con configuración regional española abre
 * mal un CSV con comas; el BOM hace que lo lea como UTF-8 sin pasar por el asistente de importación.
 */
export function toCsv(summary: GameSummaryView, options: CsvOptions = {}): string {
  const separator = options.separator ?? ';';
  const rows = [HEADER, ...summary.issues.map(rowOf)];
  return (
    BOM +
    rows.map((row) => row.map((cell) => quote(cell, separator)).join(separator)).join(LINE_BREAK) +
    LINE_BREAK
  );
}

function rowOf(issue: GameSummaryIssueView): string[] {
  return [
    text(issue.title),
    text(issue.externalUrl === null ? '' : issueKeyFromUrl(issue.externalUrl)),
    text(issue.description ?? ''),
    text(issue.externalUrl ?? ''),
    text(issue.finalEstimate ?? ''),
    issue.rounds.toString(),
    issue.agreementPercentage === null ? '' : issue.agreementPercentage.toString(),
  ];
}

/**
 * Los títulos los escribe cualquiera de la sala y el facilitador abre el fichero en una hoja de
 * cálculo, así que una celda que parezca una fórmula (`=HYPERLINK(…)`) se desactiva con un apóstrofo.
 */
function text(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function quote(cell: string, separator: CsvSeparator): string {
  const needsQuotes = cell.includes(separator) || /["\r\n]/.test(cell);
  return needsQuotes ? `"${cell.replaceAll('"', '""')}"` : cell;
}
