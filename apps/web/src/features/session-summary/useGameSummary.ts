import type { GameSummaryResponseView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import { getGameSummary } from '../../shared/api/gamesClient.js';
import { useServerReady } from '../../shared/store/serverStatusStore.js';

export interface GameSummaryState {
  readonly summary: GameSummaryResponseView | null;
  readonly error: string | null;
}

/** Espera a que la API esté despierta (ADR 0022) antes de pedir nada: en Render free el primer GET tarda. */
export function useGameSummary(gameId: string): GameSummaryState {
  const serverReady = useServerReady();
  const [state, setState] = useState<GameSummaryState>({ summary: null, error: null });

  useEffect(() => {
    if (!serverReady) return;
    let cancelled = false;
    getGameSummary(gameId)
      .then((summary) => {
        if (!cancelled) setState({ summary, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({
          summary: null,
          error: cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, serverReady]);

  return state;
}
