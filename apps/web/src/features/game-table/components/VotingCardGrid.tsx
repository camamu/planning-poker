import type { JSX } from 'react';
import { Card } from '../../../design-system/index.js';

export interface VotingCardGridProps {
  readonly cards: ReadonlyArray<string>;
  readonly selected: string | null;
  readonly disabled: boolean;
  readonly onSelect: (card: string) => void;
}

const SPECIAL_CARDS = new Set(['?', '☕']);

/** Compone `Card` (design-system) con el estado de votación real — docs/05-estructura-frontend.md §4. */
export function VotingCardGrid({
  cards,
  selected,
  disabled,
  onSelect,
}: VotingCardGridProps): JSX.Element {
  return (
    // El scroll horizontal obliga al navegador a recortar también en vertical: sin este hueco
    // arriba, la carta seleccionada (que sube 14px) se corta por la mitad.
    <div className="flex gap-2.5 overflow-x-auto pb-3 pt-4">
      {cards.map((card) => (
        <Card
          key={card}
          label={card}
          size="lg"
          special={SPECIAL_CARDS.has(card)}
          state={selected === card ? 'selected' : 'available'}
          disabled={disabled}
          onClick={() => {
            onSelect(card);
          }}
        />
      ))}
    </div>
  );
}
