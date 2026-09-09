export interface RememberedTeam {
  readonly slug: string;
  readonly name: string;
  /** El mismo token que viaja en la URL `?k=…`. Sin cuentas, es el único acceso al equipo. */
  readonly token: string;
}

const STORAGE_KEY = 'pp:teams';

/**
 * Sin cuentas no hay a quién preguntarle "¿cuáles son mis equipos?": el servidor no puede listarlos
 * sin exponer los de todo el mundo. Se recuerdan en el navegador, igual que la identidad de
 * participante, para que cerrar la pestaña no signifique perder el equipo (docs/02 §2).
 */
export function rememberedTeams(): ReadonlyArray<RememberedTeam> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRememberedTeam) : [];
  } catch {
    return [];
  }
}

export function rememberTeam(team: RememberedTeam): void {
  const others = rememberedTeams().filter((entry) => entry.slug !== team.slug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([team, ...others]));
}

export function forgetTeam(slug: string): void {
  const remaining = rememberedTeams().filter((entry) => entry.slug !== slug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

function isRememberedTeam(value: unknown): value is RememberedTeam {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.slug === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.token === 'string'
  );
}
