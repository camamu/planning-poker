import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiPicker, resolveFluentEmojiData } from './EmojiPicker.js';

const rootProps = vi.hoisted(() => ({ locale: '', emojibaseUrl: '' }));

const emojibaseData = vi.hoisted(() => ({
  locale: 'es',
  categories: [{ index: 0, label: 'Emoticonos y emociones' }],
  skinTones: { light: '', 'medium-light': '', medium: '', 'medium-dark': '', dark: '' },
  emojis: [
    { emoji: '🔥', category: 0, label: 'fuego', version: 1, tags: [] },
    { emoji: '❄️', category: 0, label: 'copo de nieve', version: 1, tags: [] },
    { emoji: '🫩', category: 0, label: 'cara con ojeras', version: 16, tags: [] },
  ],
}));

vi.mock('frimousse', () => ({
  defaultEmojiDataResolver: () => Promise.resolve(emojibaseData),
  EmojiPicker: {
    Root: ({
      children,
      onEmojiSelect,
      locale,
      emojibaseUrl,
    }: {
      children: ReactNode;
      onEmojiSelect?: (emoji: { emoji: string; label: string }) => void;
      locale?: string;
      emojibaseUrl?: string;
    }) => {
      rootProps.locale = locale ?? '';
      rootProps.emojibaseUrl = emojibaseUrl ?? '';
      return (
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
      );
    },
    Search: () => null,
    Viewport: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Loading: () => null,
    Empty: () => null,
    List: () => null,
    ActiveEmoji: () => null,
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

  it('pide los emojis en español a la propia web, no a un CDN', () => {
    render(<EmojiPicker open onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(rootProps.locale).toBe('es');
    expect(rootProps.emojibaseUrl).toBe('/emojibase');
  });
});

describe('resolveFluentEmojiData', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(['1f525', '2744'])))),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('solo ofrece los emojis que Fluent dibuja, aunque el dispositivo no los sepa pintar', async () => {
    const data = await resolveFluentEmojiData('es', {});

    expect(data.emojis.map((emoji) => emoji.emoji)).toEqual(['🔥', '❄️']);
  });

  it('si no se puede saber cuáles tiene, los ofrece todos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('sin red'))),
    );

    const data = await resolveFluentEmojiData('es', {});

    expect(data.emojis).toHaveLength(3);
  });
});
