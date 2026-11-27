import type { JSX } from 'react';
import type { UseEmojiThrowResult } from '../hooks/useEmojiThrow.js';
import { EmojiControls } from './EmojiControls.js';
import { VotingCardGrid } from './VotingCardGrid.js';

export interface HandProps {
  readonly cards: ReadonlyArray<string>;
  readonly selected: string | null;
  readonly disabled: boolean;
  readonly hint: string;
  readonly onSelect: (card: string) => void;
  readonly emoji?: UseEmojiThrowResult | undefined;
  readonly viewerId: string;
  readonly throwEmojisEnabled: boolean;
  /**
   * Móvil en vertical (docs/06-handoff-diseno.md §8): cartas de 56×80 que se deslizan y los emojis
   * fuera de la mano, debajo de la mesa.
   */
  readonly compact?: boolean | undefined;
}

export function Hand(props: HandProps): JSX.Element {
  return (
    <div
      className={`flex flex-none flex-col pb-2 pt-1 ${props.compact ? 'gap-1 px-4' : 'gap-2.5 px-7'}`}
      style={{ borderTop: '1px solid var(--color-divider)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium" style={{ color: 'var(--pp-muted)' }}>
          {props.hint}
        </span>
        {props.compact && !props.disabled ? (
          <span className="text-[11px]" style={{ color: 'var(--pp-muted)' }} aria-hidden="true">
            ⇠ desliza
          </span>
        ) : null}
        {!props.compact && props.throwEmojisEnabled && props.emoji ? (
          <EmojiControls emoji={props.emoji} viewerId={props.viewerId} />
        ) : null}
      </div>
      <VotingCardGrid
        cards={props.cards}
        selected={props.selected}
        disabled={props.disabled}
        onSelect={props.onSelect}
        compact={props.compact}
      />
    </div>
  );
}
