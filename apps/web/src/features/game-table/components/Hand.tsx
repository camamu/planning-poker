import type { JSX } from 'react';
import { VotingCardGrid } from './VotingCardGrid.js';

export interface HandProps {
  readonly cards: ReadonlyArray<string>;
  readonly selected: string | null;
  readonly disabled: boolean;
  readonly hint: string;
  readonly onSelect: (card: string) => void;
}

export function Hand(props: HandProps): JSX.Element {
  return (
    <div
      className="flex flex-none flex-col gap-2.5 px-7 pb-5 pt-4"
      style={{ borderTop: '1px solid var(--color-divider)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium" style={{ color: 'var(--pp-muted)' }}>
          {props.hint}
        </span>
      </div>
      <VotingCardGrid
        cards={props.cards}
        selected={props.selected}
        disabled={props.disabled}
        onSelect={props.onSelect}
      />
    </div>
  );
}
