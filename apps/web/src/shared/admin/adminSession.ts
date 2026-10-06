import type { AdminSessionView } from '@pp/contracts';

const STORAGE_KEY = 'pp:admin-session';

/**
 * `sessionStorage` y no `localStorage`: la sesión del panel da acceso a borrar todo, así que muere
 * con la pestaña en vez de quedarse en un navegador compartido hasta que caduque.
 */
export function loadAdminSession(now: Date = new Date()): AdminSessionView | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isAdminSession(parsed)) return null;
    return new Date(parsed.expiresAt).getTime() > now.getTime() ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSessionView): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento la sesión vive solo en memoria: se pierde al recargar, nada más.
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ídem: si no se pudo guardar, no hay nada que borrar.
  }
}

function isAdminSession(value: unknown): value is AdminSessionView {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'token' in value &&
    typeof value.token === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'string'
  );
}
