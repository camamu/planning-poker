import type { DeckSummaryView, TeamView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../design-system/index.js';
import {
  authenticateTeam,
  deleteCustomDeck,
  listDecks,
  saveCustomDeck,
  updateCustomDeck,
} from '../../shared/api/teamsClient.js';
import { CustomDeckForm } from './components/CustomDeckForm.js';
import type { CustomDeckFormValue } from './components/CustomDeckForm.js';

type Editing =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly deck: DeckSummaryView };

export function TeamPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('k');

  const [team, setTeam] = useState<TeamView | null>(null);
  const [decks, setDecks] = useState<ReadonlyArray<DeckSummaryView> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reloadDecks(teamSlug: string): Promise<void> {
    setDecks(await listDecks(teamSlug));
  }

  useEffect(() => {
    if (!slug || !token) return;
    let cancelled = false;
    authenticateTeam(slug, token)
      .then(async (resolved) => {
        if (cancelled) return;
        setTeam(resolved);
        await reloadDecks(slug);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo acceder al equipo.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  if (!slug || !token) {
    return (
      <div className="mx-auto flex w-[380px] max-w-full flex-col gap-4 py-16 text-center">
        <h1 className="text-lg">Falta el enlace del equipo</h1>
        <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
          Esta página necesita el enlace completo con el token (<code>?k=…</code>) que recibiste al
          crear el equipo.
        </p>
        <Link to="/teams/new">
          <Button variant="primary">Crear un equipo nuevo</Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-[380px] max-w-full flex-col gap-4 py-16 text-center">
        <h1 className="text-lg">No se pudo acceder</h1>
        <p style={{ color: '#e5484d' }}>{error}</p>
      </div>
    );
  }

  if (!team || !decks) {
    return <div className="mx-auto w-[380px] max-w-full py-16 text-center">Cargando…</div>;
  }

  async function handleSave(value: CustomDeckFormValue): Promise<void> {
    if (!slug || !token) return;
    setSubmitting(true);
    try {
      const command = { name: value.name, cards: [...value.cards] };
      if (editing?.mode === 'edit') {
        await updateCustomDeck(slug, token, editing.deck.id, command);
      } else {
        await saveCustomDeck(slug, token, command);
      }
      setEditing(null);
      await reloadDecks(slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la baraja.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(deck: DeckSummaryView): Promise<void> {
    if (!slug || !token) return;
    if (!window.confirm(`¿Borrar la baraja "${deck.name}"?`)) return;
    await deleteCustomDeck(slug, token, deck.id);
    await reloadDecks(slug);
  }

  return (
    <div className="mx-auto flex w-[480px] max-w-full flex-col gap-4 py-16">
      <h1 className="text-[22px]">{team.name}</h1>
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Barajas del equipo. Las de sistema son de todos; las personalizadas solo las ve y edita
        quien tenga este enlace.
      </p>

      <div className="flex flex-col gap-3">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className="flex flex-col gap-2 rounded-[10px] p-3"
            style={{ border: '1px solid var(--pp-line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{deck.name}</span>
              <span className={deck.teamId ? 'tag tag-accent' : 'tag tag-neutral'}>
                {deck.teamId ? 'personalizada' : 'del sistema'}
              </span>
            </div>
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
            <div className="flex gap-2">
              <Link to={`/?team=${slug}&deckId=${deck.id}`}>
                <Button variant="secondary">Crear partida con esta baraja</Button>
              </Link>
              {deck.teamId ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing({ mode: 'edit', deck });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void handleDelete(deck);
                    }}
                  >
                    Borrar
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="rounded-[10px] p-3" style={{ border: '1px solid var(--pp-line)' }}>
          <CustomDeckForm
            {...(editing.mode === 'edit' ? { initial: editing.deck } : {})}
            submitting={submitting}
            onSubmit={(value) => {
              void handleSave(value);
            }}
            onCancel={() => {
              setEditing(null);
            }}
          />
        </div>
      ) : (
        <Button
          variant="primary"
          block
          onClick={() => {
            setEditing({ mode: 'create' });
          }}
        >
          + Baraja nueva
        </Button>
      )}
    </div>
  );
}
