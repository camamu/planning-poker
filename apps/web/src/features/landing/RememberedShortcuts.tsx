import { useState } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Icon, iconForSeed } from '../../design-system/index.js';
import { rememberedGames } from '../../shared/games/rememberedGames.js';
import type { RememberedGame } from '../../shared/games/rememberedGames.js';
import { rememberedTeams } from '../../shared/team/rememberedTeams.js';
import type { RememberedTeam } from '../../shared/team/rememberedTeams.js';

const MAX_GAMES = 4;
const visitFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

interface Remembered {
  readonly teams: ReadonlyArray<RememberedTeam>;
  readonly games: ReadonlyArray<RememberedGame>;
}

/** Un almacenamiento bloqueado (modo privado, política del navegador) no debe tumbar la portada. */
function loadRemembered(): Remembered {
  try {
    return { teams: rememberedTeams(), games: rememberedGames().slice(0, MAX_GAMES) };
  } catch {
    return { teams: [], games: [] };
  }
}

/** «Volver a lo tuyo»: quien vuelve llega a su equipo o su partida sin pasar por la explicación. */
export function RememberedShortcuts(): JSX.Element | null {
  const [{ teams, games }] = useState(loadRemembered);
  if (teams.length === 0 && games.length === 0) return null;

  return (
    <nav aria-labelledby="landing-remembered" className="flex flex-col gap-2.5">
      <h2 id="landing-remembered" className="pp-kicker">
        Volver a lo tuyo
      </h2>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
        {teams.map((team) => (
          <li key={team.slug} className="flex-none">
            <Shortcut
              to={`/t/${team.slug}?k=${team.token}`}
              seed={team.slug}
              name={team.name}
              detail="equipo"
            />
          </li>
        ))}
        {games.map((game) => (
          <li key={game.id} className="flex-none">
            <Shortcut
              to={`/games/${game.id}`}
              seed={game.id}
              name={game.name}
              detail={visitFormat.format(new Date(game.visitedAt))}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Shortcut(props: {
  readonly to: string;
  readonly seed: string;
  readonly name: string;
  readonly detail: string;
}): JSX.Element {
  return (
    <Link
      to={props.to}
      className="flex items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--pp-line)] px-3 py-2 text-[13px] font-medium no-underline transition-colors hover:border-[var(--color-accent)]"
      style={{ color: 'var(--color-text)' }}
    >
      <span style={{ color: 'var(--color-accent)' }}>
        <Icon name={iconForSeed(props.seed)} size={16} />
      </span>
      {props.name}
      <span className="text-[11.5px] font-normal" style={{ color: 'var(--pp-muted)' }}>
        {props.detail}
      </span>
    </Link>
  );
}
