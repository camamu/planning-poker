import type { JSX } from 'react';
import { useState } from 'react';
import { EmojiPicker, SegmentedControl } from '../../../design-system/index.js';
import type { UseEmojiThrowResult } from '../hooks/useEmojiThrow.js';

export interface EmojiControlsProps {
  readonly emoji: UseEmojiThrowResult;
  readonly viewerId: string;
  /** En el móvil van debajo de la mesa, en su propia fila, y no en la cabecera de la mano. */
  readonly compact?: boolean | undefined;
}

/** Lanzar o reaccionar, la barra de emojis y el selector del resto. */
export function EmojiControls({ emoji, viewerId, compact }: EmojiControlsProps): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false);
  const armedHint = emoji.armedEmoji ? (
    <span className="text-[11px]" style={{ color: 'var(--color-accent)' }}>
      Elige a quién se lo lanzas
    </span>
  ) : null;

  return (
    <div
      className={
        compact ? 'flex flex-wrap items-center justify-center gap-1.5' : 'flex items-center gap-1.5'
      }
    >
      {compact ? null : armedHint}
      <SegmentedControl<'throw' | 'react'>
        name="emojiMode"
        value={emoji.mode}
        onChange={emoji.setMode}
        options={[
          { value: 'throw', label: '🎯 Lanzar' },
          { value: 'react', label: '💬 Reaccionar' },
        ]}
      />
      <div className="flex gap-1.5">
        {emoji.reactionBar.map((emojiChar) => (
          <button
            key={emojiChar}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[15px]"
            style={{
              border:
                emoji.armedEmoji === emojiChar
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--pp-line)',
            }}
            onClick={() => {
              emoji.pick(emojiChar, viewerId);
            }}
          >
            {emojiChar}
          </button>
        ))}
        <button
          type="button"
          aria-label="Elegir otro emoji"
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[15px]"
          style={{ border: '1px solid var(--pp-line)' }}
          onClick={() => {
            setPickerOpen(true);
          }}
        >
          +
        </button>
      </div>
      {compact && armedHint ? <div className="w-full text-center">{armedHint}</div> : null}
      <EmojiPicker
        open={pickerOpen}
        onSelect={(emojiChar) => {
          emoji.pick(emojiChar, viewerId);
          setPickerOpen(false);
        }}
        onClose={() => {
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
