import type { GameSettingsView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../design-system/index.js';
import { updateGameSettings } from '../../shared/api/gamesClient.js';
import { DeckEditorPanel } from '../deck-editor/DeckEditorPanel.js';
import { GameSettingsForm } from './components/GameSettingsForm.js';
import type { GameSettingsFormValue } from './components/GameSettingsForm.js';

export interface DeckSettingsPanelProps {
  readonly gameId: string;
  readonly participantId: string;
  readonly settings: GameSettingsView;
  readonly onClose: () => void;
}

function toFormValue(settings: GameSettingsView): GameSettingsFormValue {
  return {
    autoReveal: settings.autoReveal,
    whoCanReveal: settings.whoCanReveal === 'NAMED_LIST' ? 'ANYONE' : settings.whoCanReveal,
    allowVoteChange: settings.allowVoteChange,
    celebrate: settings.celebrate,
    throwEmojis: settings.throwEmojis,
    countdownSeconds: settings.countdownSeconds,
    revealOnTimeout: settings.revealOnTimeout,
  };
}

/** Reutiliza GameSettingsForm (también usado, colapsado, en create-game). */
export function DeckSettingsPanel(props: DeckSettingsPanelProps): JSX.Element {
  const [value, setValue] = useState<GameSettingsFormValue>(() => toFormValue(props.settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showDecks, setShowDecks] = useState(false);

  if (showDecks) {
    return (
      <DeckEditorPanel
        onClose={() => {
          setShowDecks(false);
        }}
      />
    );
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await updateGameSettings(props.gameId, {
        participantId: props.participantId,
        settings: value,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los ajustes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex h-full w-[380px] max-w-full flex-col"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <div>
          <span className="text-sm font-semibold">Ajustes finos</span>
          <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
            Se aplican a la ronda siguiente
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={props.onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <GameSettingsForm value={value} onChange={setValue} />
      </div>

      <div
        className="flex flex-col gap-2 p-4"
        style={{ borderTop: '1px solid var(--color-divider)' }}
      >
        {error ? <p style={{ color: '#e5484d' }}>{error}</p> : null}
        <Button
          variant="primary"
          block
          disabled={saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saved ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar ajustes'}
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            setValue(toFormValue(props.settings));
          }}
        >
          Volver a los de serie
        </Button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setShowDecks(true);
          }}
        >
          Ver barajas del equipo →
        </button>
      </div>
    </div>
  );
}
