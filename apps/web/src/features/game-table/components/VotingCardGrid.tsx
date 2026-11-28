import type { JSX } from 'react';
import { Card } from '../../../design-system/index.js';

export interface VotingCardGridProps {
  readonly cards: ReadonlyArray<string>;
  readonly selected: string | null;
  readonly disabled: boolean;
  readonly onSelect: (card: string) => void;
  /** Cartas de 56×80 del móvil, que suben 8 px al elegirlas en vez de 14. */
  readonly compact?: boolean | undefined;
}

const SPECIAL_CARDS = new Set(['?', '☕']);

/** Compone `Card` (design-system) con el estado de votación real — docs/05-estructura-frontend.md §4. */
export function VotingCardGrid({
  cards,
  selected,
  disabled,
  onSelect,
  compact,
}: VotingCardGridProps): JSX.Element {
  return (
    // El scroll horizontal obliga al navegador a recortar también en vertical: sin este hueco
    // arriba, la carta seleccionada (que sube 14px) se corta por la mitad.
    <div
      className={`flex overflow-x-auto ${compact ? '-mx-4 gap-2 px-4 pb-1.5 pt-3' : 'gap-2.5 pb-3 pt-4'}`}
    >
      {cards.map((card) => (
        <Card
          key={card}
          label={card}
          size={compact ? 'md' : 'lg'}
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
