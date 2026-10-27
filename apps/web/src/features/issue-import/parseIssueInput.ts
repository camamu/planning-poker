import { isHttpUrl, issueKeyFromUrl } from '@pp/contracts';

export interface ParsedIssue {
  readonly title: string;
  readonly description?: string;
  readonly externalUrl?: string;
}

const SEPARATORS = [',', ';', '\t'] as const;

const TITLE_COLUMNS = ['summary', 'title', 'titulo'];
const KEY_COLUMNS = ['key', 'issue key'];
const DESCRIPTION_COLUMNS = ['description', 'descripcion'];
const LINK_COLUMNS = ['link', 'url'];
const RECOGNIZED_COLUMNS = [
  ...TITLE_COLUMNS,
  ...KEY_COLUMNS,
  ...DESCRIPTION_COLUMNS,
  ...LINK_COLUMNS,
];

/**
 * Convierte lo que el usuario pega (o sube) en tareas, sin tocar la red (ADR 0023). Si la primera
 * línea es una cabecera CSV reconocible se lee como CSV; si no, una tarea por línea, y una línea que
 * es un enlace se convierte en tarea con su clave como título. El resto de columnas de un CSV
 * (`estimate`, `status`…) se ignora.
 */
export function parseIssueInput(text: string): ParsedIssue[] {
  const clean = text.replace(/^\uFEFF/, '');
  const separator = detectSeparator(clean);
  const rows = readCsv(clean, separator);
  const header = rows[0]?.map(normalizeColumnName);

  if (header?.some((name) => RECOGNIZED_COLUMNS.includes(name))) {
    return rows.slice(1).flatMap((row) => issueFromCsvRow(header, row));
  }
  return clean.split(/\r?\n/).flatMap(issueFromLine);
}

function normalizeColumnName(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = SEPARATORS.map((separator) => ({
    separator,
    count: firstLine.split(separator).length - 1,
  }));
  return counts.reduce((best, next) => (next.count > best.count ? next : best)).separator;
}

function issueFromLine(raw: string): ParsedIssue[] {
  const line = raw.trim();
  if (line === '') return [];
  if (/^\S+$/.test(line) && isHttpUrl(line)) {
    return [{ title: issueKeyFromUrl(line), externalUrl: line }];
  }
  return [{ title: line }];
}

function issueFromCsvRow(header: ReadonlyArray<string>, row: ReadonlyArray<string>): ParsedIssue[] {
  const cell = (names: ReadonlyArray<string>): string => {
    const index = header.findIndex((name) => names.includes(name));
    return (index === -1 ? '' : (row[index] ?? '')).trim();
  };

  const link = cell(LINK_COLUMNS);
  const externalUrl = isHttpUrl(link) ? link : undefined;
  // Sin resumen, la clave y, en último caso, la clave del enlace: una fila no se pierde por no
  // traer el título (p. ej. un CSV con solo `key` y `link`).
  const title =
    cell(TITLE_COLUMNS) ||
    cell(KEY_COLUMNS) ||
    (externalUrl === undefined ? '' : issueKeyFromUrl(externalUrl));
  if (title === '') return [];

  const description = cell(DESCRIPTION_COLUMNS);
  return [
    {
      title,
      ...(description === '' ? {} : { description }),
      ...(externalUrl === undefined ? {} : { externalUrl }),
    },
  ];
}

/**
 * CSV según RFC 4180: comillas, comillas dobles escapadas y saltos de línea dentro de una celda
 * entrecomillada. Las filas totalmente vacías (líneas en blanco, salto final) se descartan.
 */
function readCsv(text: string, separator: string): string[][] {
  const cell = new RegExp(`"((?:[^"]|"")*)"|([^${separator}\\r\\n]*)`, 'y');
  const rows: string[][] = [];
  let row: string[] = [];
  let position = 0;

  for (;;) {
    cell.lastIndex = position;
    const match = cell.exec(text);
    row.push(match?.[1] === undefined ? (match?.[2] ?? '') : match[1].replaceAll('""', '"'));
    position = cell.lastIndex;

    const next = text[position];
    if (next === separator) {
      position += 1;
      continue;
    }
    rows.push(row);
    row = [];
    if (next === undefined) break;
    position += next === '\r' && text[position + 1] === '\n' ? 2 : 1;
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}
