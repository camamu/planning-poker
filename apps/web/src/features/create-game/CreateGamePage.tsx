import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../design-system/index.js';
import { createGame } from '../../shared/api/gamesClient.js';
import { saveParticipantIdentity } from '../../shared/viewer/ParticipantIdProvider.js';
import {
  DEFAULT_SETTINGS,
  GameSettingsForm,
} from '../deck-settings/components/GameSettingsForm.js';
import type { GameSettingsFormValue } from '../deck-settings/components/GameSettingsForm.js';

type DeckPreset = 'fibonacci' | 'tshirt';

const DECKS: ReadonlyArray<{ value: DeckPreset; label: string; cards: string }> = [
  { value: 'fibonacci', label: 'Fibonacci', cards: '0.5 · 1 · 2 · 3 · 5 · 8 · 13 · ? · ☕' },
  { value: 'tshirt', label: 'Tallas', cards: 'XS · S · M · L · XL · XXL · ? · ☕' },
];

interface CreatedGame {
  readonly gameId: string;
}

export function CreateGamePage(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [facilitatorName, setFacilitatorName] = useState('');
  const [deckPreset, setDeckPreset] = useState<DeckPreset>('fibonacci');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettingsFormValue>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedGame | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createGame({
        name,
        deckPreset,
        facilitatorName,
        settings,
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
          <div className="flex flex-col gap-2">
            {DECKS.map((deck) => (
              <label key={deck.value} className="pp-radio">
                <input
                  type="radio"
                  name="deckPreset"
                  checked={deckPreset === deck.value}
                  onChange={() => {
                    setDeckPreset(deck.value);
                  }}
                />
                <span className="dot" />
                <span className="flex flex-col">
                  <span>{deck.label}</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--pp-muted)' }}>
                    {deck.cards}
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

        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear y repartir'}
        </Button>
      </form>
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
      <div
        className="h-[150px] w-[150px] rounded-[10px]"
        style={{
          background:
            'repeating-linear-gradient(45deg, var(--pp-line) 0 6px, transparent 6px 12px)',
        }}
        aria-hidden="true"
      />
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
