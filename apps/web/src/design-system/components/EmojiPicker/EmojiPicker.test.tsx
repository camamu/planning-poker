import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmojiPicker } from './EmojiPicker.js';

vi.mock('frimousse', () => ({
  EmojiPicker: {
    Root: ({
      children,
      onEmojiSelect,
    }: {
      children: ReactNode;
      onEmojiSelect?: (emoji: { emoji: string; label: string }) => void;
    }) => (
      <div>
        {children}
        <button
          type="button"
          onClick={() => {
            onEmojiSelect?.({ emoji: '🐸', label: 'frog' });
          }}
        >
          mock-emoji
        </button>
      </div>
    ),
    Search: () => null,
    Viewport: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Loading: () => null,
    Empty: () => null,
    List: () => null,
  },
}));

describe('EmojiPicker', () => {
  afterEach(cleanup);

  it('no renderiza nada si open es false', () => {
    render(<EmojiPicker open={false} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra el selector si open es true', () => {
    render(<EmojiPicker open onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('elegir un emoji llama a onSelect con ese emoji', () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('mock-emoji'));

    expect(onSelect).toHaveBeenCalledWith('🐸');
  });

  it('cerrar el modal llama a onClose', () => {
    const onClose = vi.fn();
    render(<EmojiPicker open onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('presentation'));

    expect(onClose).toHaveBeenCalled();
  });
});
