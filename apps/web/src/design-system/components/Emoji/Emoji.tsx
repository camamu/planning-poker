import { Fragment, useState } from 'react';
import type { JSX } from 'react';

/**
 * Dibujos de Fluent Emoji (plano) que sirve la propia web, uno por fichero (plugin `pp-fluent-emoji`
 * de `build/emojiAssets.ts`, ADR 0034).
 */
export const FLUENT_EMOJI_URL = '/emoji';

const VARIATION_SELECTOR_16 = 0xfe0f;

/**
 * Nombre del fichero de un emoji: sus puntos de código en hexadecimal, de al menos cuatro cifras,
 * sin el selector de variación U+FE0F, que Fluent no usa (`❤️‍🔥` → `2764-200d-1f525`).
 */
export function fluentEmojiKey(emoji: string): string {
  return Array.from(emoji, (char) => char.codePointAt(0) ?? 0)
    .filter((codePoint) => codePoint !== VARIATION_SELECTOR_16)
    .map((codePoint) => codePoint.toString(16).padStart(4, '0'))
    .join('-');
}

/**
 * Se dibuja como emoji lo que la fuente ya pinta como emoji: los de presentación de emoji, o los que
 * la piden con U+FE0F o forman un keycap. ✓, ✕, → o ☰ siguen siendo texto.
 */
const EMOJI_GRAPHEME = /\p{Emoji_Presentation}|\uFE0F|\u20E3/u;

const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export interface TextPart {
  readonly emoji: boolean;
  readonly text: string;
}

/** Trocea un texto en emojis sueltos y tramos de texto, por grafemas (una familia 👨‍👩‍👧 es uno). */
export function splitEmoji(text: string): TextPart[] {
  if (!segmenter) return [{ emoji: false, text }];
  const parts: TextPart[] = [];
  for (const { segment } of segmenter.segment(text)) {
    const emoji = EMOJI_GRAPHEME.test(segment);
    const last = parts.at(-1);
    if (!emoji && last && !last.emoji)
      parts[parts.length - 1] = { emoji: false, text: last.text + segment };
    else parts.push({ emoji, text: segment });
  }
  return parts;
}

export interface EmojiProps {
  /** Un solo emoji, tal cual (con o sin U+FE0F). */
  readonly emoji: string;
}

/**
 * Un emoji dibujado con Fluent, del tamaño del texto que lo rodea (`.pp-emoji`). Si no hay dibujo
 * (un emoji más nuevo que Fluent) o no carga, se queda el de la fuente del sistema.
 */
export function Emoji({ emoji }: EmojiProps): JSX.Element {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (failedFor === emoji) return <span className="pp-emoji-fallback">{emoji}</span>;
  return (
    <img
      className="pp-emoji"
      src={`${FLUENT_EMOJI_URL}/${fluentEmojiKey(emoji)}.svg`}
      alt={emoji}
      draggable={false}
      onError={() => {
        setFailedFor(emoji);
      }}
    />
  );
}

/** Un texto con sus emojis dibujados con Fluent («🎉 Revelada», una carta «☕»…). */
export function EmojiText({ text }: { readonly text: string }): JSX.Element {
  return (
    <>
      {splitEmoji(text).map((part, index) =>
        part.emoji ? (
          <Emoji key={index} emoji={part.text} />
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
