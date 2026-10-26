import type { AdminDeckView } from '@pp/contracts';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../../design-system/index.js';
import { deleteAdminDeck, listAdminDecks } from '../../../shared/api/adminClient.js';
import { matchesQuery } from '../matchesQuery.js';
import { useAdminList } from '../useAdminList.js';
import { AdminListState, AdminRow } from './AdminRow.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import type { AdminSectionProps } from './GamesSection.js';

export function DecksSection({ token, query, onUnauthorized }: AdminSectionProps): JSX.Element {
  const load = useCallback(() => listAdminDecks(token), [token]);
  const decks = useAdminList(load, onUnauthorized);
  const [deleting, setDeleting] = useState<AdminDeckView | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = (decks.items ?? []).filter((deck) =>
    matchesQuery(query, deck.name, deck.team?.name),
  );

  async function confirmDelete(deck: AdminDeckView): Promise<void> {
    setBusy(true);
    await decks.run(() => deleteAdminDeck(token, deck.id));
    setBusy(false);
    setDeleting(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
        Solo barajas personalizadas: las de sistema (Fibonacci y Tallas) no se pueden borrar.
      </p>
      <AdminListState
        error={decks.error}
        loading={decks.items === null}
        empty={visible.length === 0}
        emptyMessage={
          query ? 'Ninguna baraja coincide con la búsqueda.' : 'No hay barajas personalizadas.'
        }
      />
      <ul className="flex flex-col gap-3">
        {visible.map((deck) => (
          <AdminRow
            key={deck.id}
            title={deck.name}
            tag={
              <span className="tag tag-accent">
                {deck.team ? deck.team.name : 'equipo borrado'}
              </span>
            }
            actions={
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(deck);
                }}
              >
                Borrar
              </Button>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {deck.cards.map((card) => (
                <span
                  key={card}
                  className="rounded-md px-2 py-1 text-xs"
                  style={{ border: '1px solid var(--pp-line)', color: 'var(--pp-muted)' }}
                >
                  {card}
                </span>
              ))}
            </div>
          </AdminRow>
        ))}
      </ul>
      {deleting ? (
        <ConfirmDialog
          title={`¿Borrar la baraja "${deleting.name}"?`}
          confirmLabel="Borrar baraja"
          busy={busy}
          onConfirm={() => {
            void confirmDelete(deleting);
          }}
          onCancel={() => {
            setDeleting(null);
          }}
        >
          Las salas que ya la usan conservan sus cartas; el equipo deja de poder elegirla al crear
          salas nuevas.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
