import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../../design-system/index.js';

export interface CustomDeckFormValue {
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
}

export interface CustomDeckFormProps {
  readonly initial?: CustomDeckFormValue;
  readonly submitting: boolean;
  readonly onSubmit: (value: CustomDeckFormValue) => void;
  readonly onCancel: () => void;
}

function parseCards(raw: string): ReadonlyArray<string> {
  return raw
    .split(/[,\n]/)
    .map((card) => card.trim())
    .filter((card) => card.length > 0);
}

/** "?" y "☕" no se piden aquí: el servidor las añade siempre (`Deck.custom()`). */
export function CustomDeckForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CustomDeckFormProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [cardsRaw, setCardsRaw] = useState(
    (initial?.cards ?? []).filter((card) => card !== '?' && card !== '☕').join(', '),
  );

  const cards = parseCards(cardsRaw);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!name.trim() || cards.length === 0) return;
    onSubmit({ name: name.trim(), cards });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Input
        label="Nombre de la baraja"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        required
      />
      <div className="field">
        <label>Cartas (separadas por coma)</label>
        <input
          className="pp-input"
          value={cardsRaw}
          onChange={(event) => {
            setCardsRaw(event.target.value);
          }}
          placeholder="1, 2, 3, 5, 8"
          required
        />
        <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          "?" y "☕" se añaden siempre, no hace falta escribirlas.
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={submitting || cards.length === 0}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
