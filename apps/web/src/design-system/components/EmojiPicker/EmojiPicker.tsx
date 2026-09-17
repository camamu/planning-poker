import { EmojiPicker as FrimousseEmojiPicker } from 'frimousse';
import type { JSX } from 'react';
import { Modal } from '../Modal/Modal.js';

export interface EmojiPickerProps {
  readonly open: boolean;
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

/** Selector de cualquier emoji (no solo los accesos rápidos), presentacional: no sabe de partidas ni participantes. */
export function EmojiPicker({ open, onSelect, onClose }: EmojiPickerProps): JSX.Element | null {
  if (!open) return null;
  return (
    <Modal open={open} title="Elige un emoji" onClose={onClose}>
      <FrimousseEmojiPicker.Root
        className="flex h-72 w-64 flex-col gap-2"
        onEmojiSelect={(emoji) => {
          onSelect(emoji.emoji);
        }}
      >
        <FrimousseEmojiPicker.Search
          className="rounded-[9px] px-2.5 py-1.5 text-sm outline-none"
          style={{
            border: '1px solid var(--pp-line)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
          placeholder="Buscar emoji…"
        />
        <FrimousseEmojiPicker.Viewport className="flex-1 overflow-y-auto">
          <FrimousseEmojiPicker.Loading
            className="flex h-full items-center justify-center text-xs"
            style={{ color: 'var(--pp-muted)' }}
          >
            Cargando…
          </FrimousseEmojiPicker.Loading>
          <FrimousseEmojiPicker.Empty
            className="flex h-full items-center justify-center text-xs"
            style={{ color: 'var(--pp-muted)' }}
          >
            Sin resultados.
          </FrimousseEmojiPicker.Empty>
          <FrimousseEmojiPicker.List />
        </FrimousseEmojiPicker.Viewport>
      </FrimousseEmojiPicker.Root>
    </Modal>
  );
}
