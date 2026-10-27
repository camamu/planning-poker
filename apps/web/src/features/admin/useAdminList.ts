import { useCallback, useEffect, useState } from 'react';
import { AdminUnauthorizedError } from '../../shared/api/adminClient.js';

export interface AdminList<T> {
  readonly items: ReadonlyArray<T> | null;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
  /**
   * Ejecuta una acción del panel y recarga. Devuelve su resultado, o `null` si ha fallado (el error
   * queda en `error`; una sesión caducada devuelve al login).
   */
  readonly run: <R>(action: () => Promise<R>) => Promise<R | null>;
}

export function useAdminList<T>(
  load: () => Promise<ReadonlyArray<T>>,
  onUnauthorized: () => void,
): AdminList<T> {
  const [items, setItems] = useState<ReadonlyArray<T> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (cause: unknown) => {
      if (cause instanceof AdminUnauthorizedError) {
        onUnauthorized();
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Algo ha fallado.');
    },
    [onUnauthorized],
  );

  const reload = useCallback(async () => {
    try {
      setItems(await load());
      setError(null);
    } catch (cause) {
      handleError(cause);
    }
  }, [load, handleError]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((loaded) => {
        if (cancelled) return;
        setItems(loaded);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) handleError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [load, handleError]);

  const run = useCallback(
    async <R>(action: () => Promise<R>): Promise<R | null> => {
      try {
        const result = await action();
        await reload();
        return result;
      } catch (cause) {
        handleError(cause);
        return null;
      }
    },
    [reload, handleError],
  );

  return { items, error, reload, run };
}
