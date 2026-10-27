const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const LINEAR_KEY = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const NUMERIC = /^\d+$/;

/**
 * Clave corta de una tarea a partir de su enlace (ADR 0023): Jira `/browse/ABC-123` → `ABC-123`,
 * GitHub `/owner/repo/issues/42` → `repo#42`, Linear `/issue/ABC-12/slug` → `ABC-12`; en otro caso,
 * el último segmento del path. Es una función pura y sin red: el título real de la tarea no se puede
 * saber sin llamar a la API de cada gestor, y el plan lo descarta.
 *
 * Vive en `contracts` porque la usan tres sitios que tienen que coincidir: la importación (título),
 * la exportación (columna `key`) y los webhooks (campo `key`).
 */
export function issueKeyFromUrl(url: string): string {
  const trimmed = url.trim();
  const parsed = parseHttpUrl(trimmed);
  if (!parsed) return trimmed;

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  const decoded = segments.map(decodeSegment);

  return (
    jiraKey(decoded) ??
    linearKey(decoded) ??
    githubKey(decoded) ??
    decoded.at(-1) ??
    (parsed.hostname || trimmed)
  );
}

/** Lo mismo que acepta el borde para `externalUrl` (`z.url` restringido a http/https). */
export function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value.trim()) !== null;
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Busca el segmento tras `marker` en cualquier posición: Jira Server cuelga de un context path (`/jira/browse/…`). */
function keyAfter(segments: ReadonlyArray<string>, marker: string, shape: RegExp): string | null {
  const at = segments.indexOf(marker);
  const next = at === -1 ? undefined : segments[at + 1];
  return next !== undefined && shape.test(next) ? next : null;
}

function jiraKey(segments: ReadonlyArray<string>): string | null {
  return keyAfter(segments, 'browse', JIRA_KEY);
}

function linearKey(segments: ReadonlyArray<string>): string | null {
  return keyAfter(segments, 'issue', LINEAR_KEY);
}

function githubKey(segments: ReadonlyArray<string>): string | null {
  const [, repo, kind, number] = segments;
  return repo !== undefined && kind === 'issues' && number !== undefined && NUMERIC.test(number)
    ? `${repo}#${number}`
    : null;
}
