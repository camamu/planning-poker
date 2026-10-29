import { TEAM_GAMES_DEFAULT_LIMIT } from '@pp/contracts';
import type { TeamGameView } from '@pp/contracts';
import { useCallback, useEffect, useState } from 'react';
import { listTeamGames } from '../../shared/api/teamsClient.js';

export const TEAM_GAMES_PAGE_SIZE = TEAM_GAMES_DEFAULT_LIMIT;

export interface TeamGamesState {
  readonly games: ReadonlyArray<TeamGameView>;
  readonly loading: boolean;
  readonly error: string | null;
  /** Una página llena puede tener otra detrás; una corta es la última. */
  readonly hasMore: boolean;
  /** Pide la página siguiente a la última partida vista; tras un error, reintenta la misma. */
  readonly loadMore: () => void;
}

interface PageRequest {
  /** El `createdAt` de la última partida vista, o `undefined` para la primera página. */
  readonly before: string | undefined;
  /** Cambia en cada petición para que reintentar la misma página vuelva a disparar el efecto. */
  readonly attempt: number;
}

/** Hay que montarlo con `key` por equipo: no reinicia la lista si cambian `slug` o `token`. */
export function useTeamGames(slug: string, token: string): TeamGamesState {
  const [games, setGames] = useState<ReadonlyArray<TeamGameView>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [request, setRequest] = useState<PageRequest>({ before: undefined, attempt: 0 });

  useEffect(() => {
    let cancelled = false;
    listTeamGames(slug, token, { limit: TEAM_GAMES_PAGE_SIZE, before: request.before })
      .then((page) => {
        if (cancelled) return;
        setGames((previous) => (request.before === undefined ? page : [...previous, ...page]));
        setHasMore(page.length === TEAM_GAMES_PAGE_SIZE);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las partidas.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token, request]);

  const loadMore = useCallback(() => {
    setLoading(true);
    setError(null);
    setRequest((previous) => ({ before: games.at(-1)?.createdAt, attempt: previous.attempt + 1 }));
  }, [games]);

  return { games, loading, error, hasMore, loadMore };
}
