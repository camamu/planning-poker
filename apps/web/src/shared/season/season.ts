import { useState } from 'react';

/** Única temporada que existe por ahora (docs/adr/0031-ambientacion-navidena.md). */
export type Season = 'winter';

/** Del 1 de diciembre al 6 de enero, los dos incluidos, con la fecha local del navegador. */
export function isWinterSeason(date: Date): boolean {
  const month = date.getMonth();
  return month === 11 || (month === 0 && date.getDate() <= 6);
}

/**
 * `?temporada=invierno` fuerza la ambientación fuera de fechas (para probarla y para capturas) y
 * `?temporada=no` la quita en plena temporada. `null` = sin forzar.
 */
export type SeasonOverride = Season | 'none' | null;

export function parseSeasonOverride(search: string): SeasonOverride {
  const value = new URLSearchParams(search).get('temporada');
  if (value === 'invierno') return 'winter';
  if (value === 'no') return 'none';
  return null;
}

export function resolveSeason(now: Date, override: SeasonOverride): Season | null {
  if (override === 'winter') return 'winter';
  if (override === 'none') return null;
  return isWinterSeason(now) ? 'winter' : null;
}

const OVERRIDE_KEY = 'pp:season-override';

/**
 * El parámetro solo llega en la primera URL: al navegar dentro de la app desaparece. Se guarda en
 * `sessionStorage` para que la vista previa dure lo que dura la pestaña.
 */
function readOverride(): SeasonOverride {
  const fromUrl = parseSeasonOverride(window.location.search);
  try {
    if (fromUrl) {
      sessionStorage.setItem(OVERRIDE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(OVERRIDE_KEY);
    return stored === 'winter' || stored === 'none' ? stored : null;
  } catch {
    return fromUrl;
  }
}

/** Se calcula una vez por montaje: una sesión que cruce la medianoche del 6 de enero no cambia. */
export function useSeason(): Season | null {
  const [season] = useState(() => resolveSeason(new Date(), readOverride()));
  return season;
}

const SNOW_OFF_KEY = 'pp:snow-off';

/** Preferencia personal «sin nieve» (botón ❄ de la barra superior). */
export function readSnowOff(): boolean {
  try {
    return localStorage.getItem(SNOW_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSnowOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(SNOW_OFF_KEY, '1');
    else localStorage.removeItem(SNOW_OFF_KEY);
  } catch {
    // Sin almacenamiento (modo privado estricto) la preferencia dura lo que dura la página.
  }
}
