import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Emoji, EmojiText, fluentEmojiKey, splitEmoji } from './Emoji.js';

describe('fluentEmojiKey', () => {
  it('nombra el dibujo por sus puntos de código, sin el selector de variación', () => {
    expect(fluentEmojiKey('🔥')).toBe('1f525');
    expect(fluentEmojiKey('❄️')).toBe('2744');
    expect(fluentEmojiKey('❤️‍🔥')).toBe('2764-200d-1f525');
    expect(fluentEmojiKey('👍🏽')).toBe('1f44d-1f3fd');
  });

  it('rellena hasta cuatro cifras, como los keycaps de Fluent', () => {
    expect(fluentEmojiKey('#️⃣')).toBe('0023-20e3');
  });
});

describe('splitEmoji', () => {
  it('separa los emojis del texto y deja como texto ✓, ✕ y las flechas', () => {
    expect(splitEmoji('🎉 Revelada')).toEqual([
      { emoji: true, text: '🎉' },
      { emoji: false, text: ' Revelada' },
    ]);
    expect(splitEmoji('Copiado ✓ → ✕')).toEqual([{ emoji: false, text: 'Copiado ✓ → ✕' }]);
  });

  it('una secuencia con ZWJ o con tono de piel es un solo emoji', () => {
    expect(splitEmoji('👨‍👩‍👧👍🏽')).toEqual([
      { emoji: true, text: '👨‍👩‍👧' },
      { emoji: true, text: '👍🏽' },
    ]);
  });
});

describe('Emoji', () => {
  afterEach(cleanup);

  it('pinta el dibujo de Fluent con el emoji como texto alternativo', () => {
    render(<Emoji emoji="☕" />);

    const image = screen.getByRole('img', { name: '☕' });
    expect(image).toHaveAttribute('src', '/emoji/2615.svg');
  });

  it('si el dibujo no existe o no carga, se queda el emoji del sistema', () => {
    render(<Emoji emoji="🫩" />);

    fireEvent.error(screen.getByRole('img', { name: '🫩' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🫩')).toBeInTheDocument();
  });
});

describe('EmojiText', () => {
  afterEach(cleanup);

  it('dibuja los emojis y deja el resto del texto igual', () => {
    const { container } = render(<EmojiText text="🎉 Revelada" />);

    expect(screen.getByRole('img', { name: '🎉' })).toBeInTheDocument();
    expect(container).toHaveTextContent('Revelada');
  });
});
