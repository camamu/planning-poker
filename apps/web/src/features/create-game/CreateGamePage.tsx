import type { DeckSummaryView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, QrCode } from '../../design-system/index.js';
import { createGame } from '../../shared/api/gamesClient.js';
import { listDecks } from '../../shared/api/teamsClient.js';
import type { RememberedTeam } from '../../shared/team/rememberedTeams.js';
import { rememberedTeams } from '../../shared/team/rememberedTeams.js';
import { saveParticipantIdentity } from '../../shared/viewer/ParticipantIdProvider.js';
import {
  DEFAULT_SETTINGS,
  GameSettingsForm,
} from '../deck-settings/components/GameSettingsForm.js';
import type { GameSettingsFormValue } from '../deck-settings/components/GameSettingsForm.js';

interface CreatedGame {
  readonly gameId: string;
}

export function CreateGamePage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamSlug = searchParams.get('team') ?? undefined;

  const [name, setName] = useState('');
  const [facilitatorName, setFacilitatorName] = useState('');
  const [decks, setDecks] = useState<ReadonlyArray<DeckSummaryView> | null>(null);
  const [deckId, setDeckId] = useState<string | null>(searchParams.get('deckId'));
  const [decksError, setDecksError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettingsFormValue>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedGame | null>(null);
  const [teams] = useState<ReadonlyArray<RememberedTeam>>(rememberedTeams);

  useEffect(() => {
    let cancelled = false;
    listDecks(teamSlug)
      .then((available) => {
        if (cancelled) return;
        setDecks(available);
        setDeckId((current) => current ?? available[0]?.id ?? null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDecksError(
          cause instanceof Error ? cause.message : 'No se pudieron cargar las barajas.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!deckId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await createGame({
        name,
        deckId,
        facilitatorName,
        settings,
        ...(teamSlug ? { teamSlug } : {}),
      });
      saveParticipantIdentity(result.gameId, {
        participantId: result.facilitatorId,
        displayName: facilitatorName,
      });
      setCreated({ gameId: result.gameId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la partida.');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <LinkReadyPanel
        gameId={created.gameId}
        onEnter={() => {
          void navigate(`/games/${created.gameId}`);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-[420px] max-w-full flex-col gap-4 py-16">
      <h1 className="text-[22px]">Crear partida</h1>
      {teamSlug ? (
        <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Con las barajas de{' '}
          <strong>{teams.find((t) => t.slug === teamSlug)?.name ?? teamSlug}</strong> ·{' '}
          <Link to="/">salir del equipo</Link>
        </p>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Input
          label="Nombre de la partida"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          required
        />
        <Input
          label="Tu nombre (facilitador)"
          value={facilitatorName}
          onChange={(event) => {
            setFacilitatorName(event.target.value);
          }}
          required
        />

        <div className="field">
          <label>Baraja</label>
          {decksError ? <p style={{ color: '#e5484d' }}>{decksError}</p> : null}
          <div className="flex flex-col gap-2">
            {(decks ?? []).map((deck) => (
              <label key={deck.id} className="pp-radio">
                <input
                  type="radio"
                  name="deckId"
                  checked={deckId === deck.id}
                  onChange={() => {
                    setDeckId(deck.id);
                  }}
                />
                <span className="dot" />
                <span className="flex flex-col">
                  <span>
                    {deck.name}
                    {deck.teamId ? <span className="tag tag-neutral"> personalizada</span> : null}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--pp-muted)' }}>
                    {deck.cards.join(' · ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="pp-tab text-left"
          aria-expanded={settingsOpen}
          onClick={() => {
            setSettingsOpen((open) => !open);
          }}
        >
          Ajustes finos {settingsOpen ? '▴' : '▾'}
        </button>
        {settingsOpen ? <GameSettingsForm value={settings} onChange={setSettings} /> : null}

        {error ? <p style={{ color: '#e5484d' }}>{error}</p> : null}

        <Button type="submit" variant="primary" block disabled={submitting || !deckId}>
          {submitting ? 'Creando…' : 'Crear y repartir'}
        </Button>
      </form>

      {teamSlug ? null : <TeamShortcuts teams={teams} />}
    </div>
  );
}

function TeamShortcuts({ teams }: { readonly teams: ReadonlyArray<RememberedTeam> }): JSX.Element {
  if (teams.length === 0) {
    return (
      <Link to="/teams/new" className="text-center text-xs" style={{ color: 'var(--pp-muted)' }}>
        ¿Quieres guardar barajas personalizadas? Crea un equipo →
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="pp-kicker">Tus equipos</span>
      {teams.map((team) => (
        <div
          key={team.slug}
          className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2"
          style={{ border: '1px solid var(--pp-line)' }}
        >
          <span className="truncate text-sm">{team.name}</span>
          <div className="flex flex-none gap-2">
            <Link to={`/?team=${team.slug}`}>
              <Button variant="secondary">Usar sus barajas</Button>
            </Link>
            <Link to={`/t/${team.slug}?k=${team.token}`}>
              <Button variant="ghost">Abrir</Button>
            </Link>
          </div>
        </div>
      ))}
      <Link to="/teams/new" className="text-center text-xs" style={{ color: 'var(--pp-muted)' }}>
        Crear otro equipo →
      </Link>
    </div>
  );
}

function LinkReadyPanel({
  gameId,
  onEnter,
}: {
  readonly gameId: string;
  readonly onEnter: () => void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/games/${gameId}`;

  return (
    <div className="mx-auto flex w-[340px] max-w-full flex-col items-center gap-4 py-16 text-center">
      <QrCode value={link} size={150} aria-label="Código QR para entrar a la partida" />
      <h2 className="text-lg">Partida lista</h2>
      <div className="pp-input flex items-center justify-between gap-2 font-mono text-xs">
        <span className="truncate">{link}</span>
      </div>
      <div className="flex w-full gap-2">
        <Button
          variant="secondary"
          block
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </Button>
      </div>
      <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
        El enlace no caduca mientras la partida siga abierta.
      </p>
      <Button variant="primary" block onClick={onEnter}>
        Entrar a la mesa
      </Button>
    </div>
  );
}
