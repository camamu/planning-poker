export interface RememberedGame {
  readonly id: string;
  readonly name: string;
  /** ISO 8601 de la última vez que se entró en la sala; ordena la lista. */
  readonly visitedAt: string;
}

const STORAGE_KEY = 'pp:games';
export const MAX_REMEMBERED_GAMES = 10;

/**
 * Las partidas creadas fuera de un equipo no tienen dueño y el servidor no puede listarlas sin
 * exponer las de todo el mundo (ADR 0024): se recuerdan en el navegador, como los equipos.
 */
export function rememberedGames(): ReadonlyArray<RememberedGame> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRememberedGame) : [];
  } catch {
    return [];
  }
}

export function rememberGame(
  game: { readonly id: string; readonly name: string },
  now: Date = new Date(),
): void {
  const others = rememberedGames().filter((entry) => entry.id !== game.id);
  const next = [{ ...game, visitedAt: now.toISOString() }, ...others].slice(
    0,
    MAX_REMEMBERED_GAMES,
  );
  save(next);
}

export function forgetGame(id: string): void {
  save(rememberedGames().filter((entry) => entry.id !== id));
}

/** Recordar es una comodidad: un almacenamiento lleno o bloqueado no debe tumbar la sala. */
function save(games: ReadonlyArray<RememberedGame>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // Sin almacenamiento disponible la lista simplemente no se actualiza.
  }
}

function isRememberedGame(value: unknown): value is RememberedGame {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.visitedAt === 'string'
  );
}
