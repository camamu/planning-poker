import type { DeckSummaryView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { changeGameDeck, listGameDecks } from '../../../shared/api/gamesClient.js';

export interface GameDeckPickerProps {
  readonly gameId: string;
  readonly participantId: string;
  readonly currentCards: ReadonlyArray<string>;
  /** Con una ronda abierta el servidor rechaza el cambio; se avisa en vez de dejar fallar el clic. */
  readonly locked: boolean;
}

/**
 * La partida guarda una copia de las cartas, no el id de la baraja de origen (ADR 0006), así que
 * la baraja activa se reconoce por igualdad de cartas. Si la baraja de equipo se editó después de
 * crear la partida no habrá coincidencia y ninguna opción aparece marcada.
 */
function sameCards(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  return a.length === b.length && a.every((card, index) => card === b[index]);
}

export function GameDeckPicker(props: GameDeckPickerProps): JSX.Element {
  const [decks, setDecks] = useState<ReadonlyArray<DeckSummaryView> | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGameDecks(props.gameId)
      .then((available) => {
        if (!cancelled) setDecks(available);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las barajas.');
      });
    return () => {
      cancelled = true;
    };
  }, [props.gameId]);

  async function handleSelect(deckId: string): Promise<void> {
    setPendingId(deckId);
    setError(null);
    try {
      await changeGameDeck(props.gameId, { participantId: props.participantId, deckId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar la baraja.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="field">
      <label>Baraja</label>
      {props.locked ? (
        <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Hay una ronda abierta: revélala para poder cambiar de baraja.
        </p>
      ) : null}
      {error ? <p style={{ color: '#e5484d' }}>{error}</p> : null}
      <div className="flex flex-col gap-2">
        {(decks ?? []).map((deck) => (
          <label key={deck.id} className="pp-radio">
            <input
              type="radio"
              name="gameDeckId"
              checked={sameCards(deck.cards, props.currentCards)}
              disabled={props.locked || pendingId !== null}
              onChange={() => {
                void handleSelect(deck.id);
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
  );
}
