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
    <div className="flex gap-2.5 overflow-x-auto">
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
