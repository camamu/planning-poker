import {
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_URL_LENGTH,
  isHttpUrl,
  issueKeyFromUrl,
} from '@pp/contracts';

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

/**
 * El servidor rechaza una importación entera si una tarea excede un máximo (ADR 0023: todas o
 * ninguna), así que lo que no cabe se recorta aquí con una elipsis en lugar de tumbar el lote. Sin
 * partir un par sustituto: medio emoji no es texto válido.
 */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max - 1;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

/** Un enlace que no cabe no se recorta (quedaría roto): se descarta y la tarea se conserva. */
function usableLink(link: string): string | undefined {
  return isHttpUrl(link) && link.length <= MAX_URL_LENGTH ? link : undefined;
}

function issueFromLine(raw: string): ParsedIssue[] {
  const line = raw.trim();
  if (line === '') return [];
  const link = /^\S+$/.test(line) ? usableLink(line) : undefined;
  if (link !== undefined) {
    return [{ title: clamp(issueKeyFromUrl(link), MAX_ISSUE_TITLE_LENGTH), externalUrl: link }];
  }
  return [{ title: clamp(line, MAX_ISSUE_TITLE_LENGTH) }];
}

function issueFromCsvRow(header: ReadonlyArray<string>, row: ReadonlyArray<string>): ParsedIssue[] {
  const cell = (names: ReadonlyArray<string>): string => {
    const index = header.findIndex((name) => names.includes(name));
    return (index === -1 ? '' : (row[index] ?? '')).trim();
  };

  const externalUrl = usableLink(cell(LINK_COLUMNS));
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
      title: clamp(title, MAX_ISSUE_TITLE_LENGTH),
      ...(description === ''
        ? {}
        : { description: clamp(description, MAX_ISSUE_DESCRIPTION_LENGTH) }),
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
