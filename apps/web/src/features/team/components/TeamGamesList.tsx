import type { TeamGameView } from '@pp/contracts';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../design-system/index.js';
import { useTeamGames } from '../useTeamGames.js';

export interface TeamGamesListProps {
  readonly slug: string;
  readonly token: string;
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

function describeGame(game: TeamGameView): string {
  const participants = `${game.participantCount.toString()} ${game.participantCount === 1 ? 'participante' : 'participantes'}`;
  return `${dateFormat.format(new Date(game.createdAt))} · ${game.estimatedCount.toString()}/${game.issueCount.toString()} tareas estimadas · ${participants}`;
}

function TeamGameRow({ game }: { readonly game: TeamGameView }): JSX.Element {
  return (
    <li
      className="flex items-center justify-between gap-3 rounded-[10px] p-3"
      style={{ border: '1px solid var(--pp-line)' }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{game.name}</span>
        <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          {describeGame(game)}
        </span>
      </div>
      <div className="flex flex-none gap-2">
        <Link to={`/games/${game.id}/summary`}>
          <Button variant="ghost">Resumen</Button>
        </Link>
        <Link to={`/games/${game.id}`}>
          <Button variant="secondary">Abrir</Button>
        </Link>
      </div>
    </li>
  );
}

export function TeamGamesList({ slug, token }: TeamGamesListProps): JSX.Element {
  const { games, loading, error, hasMore, loadMore } = useTeamGames(slug, token);

  return (
    <div className="flex flex-col gap-3">
      {games.length === 0 && !loading && !error ? (
        <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
          Este equipo todavía no tiene partidas. Las que se creen con sus barajas aparecerán aquí.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {games.map((game) => (
          <TeamGameRow key={game.id} game={game} />
        ))}
      </ul>

      {loading ? (
        <p className="text-center text-sm" style={{ color: 'var(--pp-muted)' }}>
          Cargando partidas…
        </p>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: '#e5484d' }}>{error}</p>
          <Button variant="secondary" onClick={loadMore}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {hasMore && !loading && !error ? (
        <Button variant="ghost" block onClick={loadMore}>
          Ver partidas anteriores
        </Button>
      ) : null}
    </div>
  );
}
