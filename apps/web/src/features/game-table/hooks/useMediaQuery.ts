import { useCallback, useSyncExternalStore } from 'react';

/** Sala compacta del móvil en vertical (docs/06-handoff-diseno.md §8): por debajo de `sm` de Tailwind. */
export const COMPACT_ROOM_QUERY = '(max-width: 639px)';

/** La fila de botones de la cabecera no cabe por debajo de `md`: ahí va dentro del menú ☰. */
export const COMPACT_HEADER_QUERY = '(max-width: 767px)';

function mediaQueryList(query: string): MediaQueryList | null {
  // jsdom no implementa matchMedia: sin él, la sala se pinta como en escritorio.
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

/** `true` mientras la media query se cumple; se actualiza al girar el móvil o redimensionar. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaQueryList(query);
      list?.addEventListener('change', onChange);
      return () => {
        list?.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => mediaQueryList(query)?.matches ?? false,
    () => false,
  );
}
