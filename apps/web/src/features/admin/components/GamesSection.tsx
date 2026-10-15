import type { AdminGameView } from '@pp/contracts';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../design-system/index.js';
import { deleteAdminGame, listAdminGames } from '../../../shared/api/adminClient.js';
import { matchesQuery } from '../matchesQuery.js';
import { plural } from '../plural.js';
import { useAdminList } from '../useAdminList.js';
import { AdminListState, AdminRow } from './AdminRow.js';
import { ConfirmDialog } from './ConfirmDialog.js';

export interface AdminSectionProps {
  readonly token: string;
  readonly query: string;
  readonly onUnauthorized: () => void;
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export function GamesSection({ token, query, onUnauthorized }: AdminSectionProps): JSX.Element {
  const load = useCallback(() => listAdminGames(token), [token]);
  const games = useAdminList(load, onUnauthorized);
  const [deleting, setDeleting] = useState<AdminGameView | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = (games.items ?? []).filter((game) =>
    matchesQuery(query, game.name, game.team?.name, game.id),
  );

  async function confirmDelete(game: AdminGameView): Promise<void> {
    setBusy(true);
    await games.run(() => deleteAdminGame(token, game.id));
    setBusy(false);
    setDeleting(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <AdminListState
        error={games.error}
        loading={games.items === null}
        empty={visible.length === 0}
        emptyMessage={query ? 'Ninguna sala coincide con la búsqueda.' : 'No hay salas.'}
      />
      <ul className="flex flex-col gap-3">
        {visible.map((game) => (
          <AdminRow
            key={game.id}
            title={game.name}
            tag={
              <span className={game.team ? 'tag tag-accent' : 'tag tag-neutral'}>
                {game.team ? game.team.name : 'sin equipo'}
              </span>
            }
            meta={`${plural(game.participantCount, 'participante', 'participantes')} · ${game.estimatedIssueCount.toString()}/${game.issueCount.toString()} tareas estimadas · creada ${dateFormat.format(new Date(game.createdAt))}`}
            actions={
              <>
                <Link to={`/games/${game.id}`}>
                  <Button variant="secondary">Abrir</Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeleting(game);
                  }}
                >
                  Borrar
                </Button>
              </>
            }
          />
        ))}
      </ul>
      {deleting ? (
        <ConfirmDialog
          title={`¿Borrar la sala "${deleting.name}"?`}
          confirmLabel="Borrar sala"
          busy={busy}
          onConfirm={() => {
            void confirmDelete(deleting);
          }}
          onCancel={() => {
            setDeleting(null);
          }}
        >
          Se pierden sus participantes, tareas y votos. Quien esté en la mesa ahora mismo verá que
          la sala se ha cerrado. No se puede deshacer.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
