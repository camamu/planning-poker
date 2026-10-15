import type { AdminTeamView } from '@pp/contracts';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button, Input, Modal } from '../../../design-system/index.js';
import {
  deleteAdminTeam,
  listAdminTeams,
  regenerateAdminTeamToken,
  renameAdminTeam,
} from '../../../shared/api/adminClient.js';
import { matchesQuery } from '../matchesQuery.js';
import { plural } from '../plural.js';
import { useAdminList } from '../useAdminList.js';
import { AdminListState, AdminRow } from './AdminRow.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import type { AdminSectionProps } from './GamesSection.js';

type Pending =
  | { readonly kind: 'rename'; readonly team: AdminTeamView }
  | { readonly kind: 'regenerate'; readonly team: AdminTeamView }
  | { readonly kind: 'delete'; readonly team: AdminTeamView }
  | { readonly kind: 'link'; readonly team: AdminTeamView; readonly link: string };

export function TeamsSection({ token, query, onUnauthorized }: AdminSectionProps): JSX.Element {
  const load = useCallback(() => listAdminTeams(token), [token]);
  const teams = useAdminList(load, onUnauthorized);
  const [pending, setPending] = useState<Pending | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = (teams.items ?? []).filter((team) => matchesQuery(query, team.name, team.slug));

  async function perform(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    await teams.run(action);
    setBusy(false);
    setPending(null);
  }

  async function regenerate(team: AdminTeamView): Promise<void> {
    setBusy(true);
    const result = await teams.run(() => regenerateAdminTeamToken(token, team.id));
    setBusy(false);
    setPending(
      result === null
        ? null
        : {
            kind: 'link',
            team,
            link: `${window.location.origin}/t/${result.slug}?k=${result.token}`,
          },
    );
  }

  const close = (): void => {
    setPending(null);
  };

  return (
    <section className="flex flex-col gap-3">
      <AdminListState
        error={teams.error}
        loading={teams.items === null}
        empty={visible.length === 0}
        emptyMessage={query ? 'Ningún equipo coincide con la búsqueda.' : 'No hay equipos.'}
      />
      <ul className="flex flex-col gap-3">
        {visible.map((team) => (
          <AdminRow
            key={team.id}
            title={team.name}
            tag={<span className="tag tag-neutral font-mono">{team.slug}</span>}
            meta={`${plural(team.deckCount, 'baraja', 'barajas')} · ${plural(team.gameCount, 'sala', 'salas')}`}
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNewName(team.name);
                    setPending({ kind: 'rename', team });
                  }}
                >
                  Renombrar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPending({ kind: 'regenerate', team });
                  }}
                >
                  Nuevo enlace
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPending({ kind: 'delete', team });
                  }}
                >
                  Borrar
                </Button>
              </>
            }
          />
        ))}
      </ul>

      {pending?.kind === 'rename' ? (
        <ConfirmDialog
          title={`Renombrar "${pending.team.name}"`}
          confirmLabel="Guardar"
          busy={busy || newName.trim() === ''}
          onConfirm={() => {
            void perform(() => renameAdminTeam(token, pending.team.id, { name: newName }));
          }}
          onCancel={close}
        >
          <div className="flex flex-col gap-2">
            <Input
              label="Nombre del equipo"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
              }}
              autoFocus
            />
            <span className="text-xs">
              El enlace del equipo (<code>/t/{pending.team.slug}</code>) no cambia.
            </span>
          </div>
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'regenerate' ? (
        <ConfirmDialog
          title={`¿Nuevo enlace para "${pending.team.name}"?`}
          confirmLabel="Generar enlace"
          busy={busy}
          onConfirm={() => {
            void regenerate(pending.team);
          }}
          onCancel={close}
        >
          El enlace actual deja de funcionar al instante para todo el equipo. Útil si se ha perdido
          o se ha compartido con quien no debía.
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'delete' ? (
        <ConfirmDialog
          title={`¿Borrar el equipo "${pending.team.name}"?`}
          confirmLabel="Borrar equipo"
          busy={busy}
          onConfirm={() => {
            void perform(() => deleteAdminTeam(token, pending.team.id));
          }}
          onCancel={close}
        >
          Se borran también sus {plural(pending.team.deckCount, 'baraja', 'barajas')}{' '}
          personalizadas. Sus {plural(pending.team.gameCount, 'sala', 'salas')} se conservan, sin
          equipo. No se puede deshacer.
        </ConfirmDialog>
      ) : null}

      <Modal
        open={pending?.kind === 'link'}
        title="Enlace nuevo del equipo"
        onClose={close}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (pending?.kind === 'link') void navigator.clipboard.writeText(pending.link);
              }}
            >
              Copiar enlace
            </Button>
            <Button variant="primary" onClick={close}>
              Hecho
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <span>
            Solo se muestra ahora: el servidor no guarda el token en claro. Pásaselo al equipo.
          </span>
          <div className="pp-input font-mono text-xs break-all">
            {pending?.kind === 'link' ? pending.link : ''}
          </div>
        </div>
      </Modal>
    </section>
  );
}
