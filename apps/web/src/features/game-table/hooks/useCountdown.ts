import { useEffect, useState } from 'react';

/**
 * F5 — cuenta atrás local a partir de la fecha límite que manda el servidor (nunca al revés).
 * `Date.now()` solo se lee dentro del efecto (nunca durante el render, que debe quedar puro), y
 * la primera actualización se difiere con `setTimeout(…, 0)` para no llamar a `setState` de forma
 * síncrona dentro del propio efecto.
 */
export function useCountdown(deadline: string | null): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      const timeout = setTimeout(() => {
        setRemainingMs(null);
      }, 0);
      return () => {
        clearTimeout(timeout);
      };
    }
    const deadlineMs = new Date(deadline).getTime();
    const update = (): void => {
      setRemainingMs(Math.max(0, deadlineMs - Date.now()));
    };
    const timeout = setTimeout(update, 0);
    const interval = setInterval(update, 250);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [deadline]);

  return remainingMs;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
