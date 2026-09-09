import type { JSX } from 'react';
import { SegmentedControl } from '../../../design-system/index.js';
import type { UseEmojiThrowResult } from '../hooks/useEmojiThrow.js';
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
}

export function Hand(props: HandProps): JSX.Element {
  return (
    <div
      className="flex flex-none flex-col gap-2.5 px-7 pb-2 pt-1"
      style={{ borderTop: '1px solid var(--color-divider)', background: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium" style={{ color: 'var(--pp-muted)' }}>
          {props.hint}
        </span>
        {props.throwEmojisEnabled && props.emoji ? (
          <div className="flex items-center gap-1.5">
            {props.emoji.armedEmoji ? (
              <span className="text-[11px]" style={{ color: 'var(--color-accent)' }}>
                Elige a quién se lo lanzas
              </span>
            ) : null}
            <SegmentedControl<'throw' | 'react'>
              name="emojiMode"
              value={props.emoji.mode}
              onChange={props.emoji.setMode}
              options={[
                { value: 'throw', label: '🎯 Lanzar' },
                { value: 'react', label: '💬 Reaccionar' },
              ]}
            />
            {props.emoji.reactionBar.map((emojiChar) => (
              <button
                key={emojiChar}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[15px]"
                style={{
                  border:
                    props.emoji?.armedEmoji === emojiChar
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--pp-line)',
                }}
                onClick={() => {
                  props.emoji?.pick(emojiChar, props.viewerId);
                }}
              >
                {emojiChar}
              </button>
            ))}
          </div>
        ) : null}
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
