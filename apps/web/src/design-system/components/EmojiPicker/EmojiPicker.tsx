import { defaultEmojiDataResolver, EmojiPicker as FrimousseEmojiPicker } from 'frimousse';
import type {
  EmojiDataResolver,
  EmojiPickerListCategoryHeaderProps,
  EmojiPickerListEmojiProps,
  EmojiPickerListRowProps,
} from 'frimousse';
import type { CSSProperties, JSX } from 'react';
import { Emoji, FLUENT_EMOJI_URL, fluentEmojiKey } from '../Emoji/Emoji.js';
import { Modal } from '../Modal/Modal.js';

export interface EmojiPickerProps {
  readonly open: boolean;
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

/**
 * Los datos de los emojis los sirve la propia web (plugin `pp-emojibase` de `vite.config.ts`):
 * en español y sin pedirlos a un CDN ajeno cada vez que se abre el selector.
 */
export const EMOJIBASE_URL = '/emojibase';

async function fluentEmojiKeys(signal: AbortSignal | undefined): Promise<ReadonlySet<string>> {
  const response = await fetch(`${FLUENT_EMOJI_URL}/index.json`, { signal: signal ?? null });
  const keys: unknown = await response.json();
  if (!Array.isArray(keys)) throw new Error('El índice de Fluent Emoji no es una lista');
  return new Set(keys.filter((key): key is string => typeof key === 'string'));
}

/**
 * Solo los emojis que Fluent dibuja (ADR 0034): así no se cuela ninguno con la fuente del sistema, y
 * se ven también los que el dispositivo todavía no sabe pintar. Con un `resolveEmojiData` propio
 * frimousse ya no esconde los que el navegador no soporta, que aquí es justo lo que se quiere. Si el
 * índice no carga, se enseñan todos: los que no tengan dibujo se quedan con el del sistema.
 */
export const resolveFluentEmojiData: EmojiDataResolver = async (locale, options) => {
  const [data, keys] = await Promise.all([
    defaultEmojiDataResolver(locale, options),
    fluentEmojiKeys(options.signal).catch(() => null),
  ]);
  if (!keys) return data;
  return { ...data, emojis: data.emojis.filter((emoji) => keys.has(fluentEmojiKey(emoji.emoji))) };
};

/**
 * Celdas de unos 45 px, como la barra de reacciones y por encima del mínimo táctil del móvil:
 * 9 columnas caben en el diálogo de 440 px, y 7 en el de un móvil en vertical.
 */
function columnsForViewport(): number {
  return window.innerWidth < 480 ? 7 : 9;
}

/** Cuántas columnas tiene la lista, para que cada emoji ocupe su parte de la fila. */
type ColumnsStyle = CSSProperties & { '--pp-emoji-columns': string };

/** Selector de cualquier emoji (no solo los accesos rápidos), presentacional: no sabe de partidas ni participantes. */
export function EmojiPicker({ open, onSelect, onClose }: EmojiPickerProps): JSX.Element | null {
  if (!open) return null;
  const columns = columnsForViewport();
  const style: ColumnsStyle = { '--pp-emoji-columns': columns.toString() };
  return (
    <Modal open={open} title="Elige un emoji" onClose={onClose}>
      <FrimousseEmojiPicker.Root
        locale="es"
        emojibaseUrl={EMOJIBASE_URL}
        resolveEmojiData={resolveFluentEmojiData}
        columns={columns}
        className="flex h-[min(26rem,60dvh)] w-full flex-col gap-2"
        style={style}
        onEmojiSelect={(emoji) => {
          onSelect(emoji.emoji);
        }}
      >
        <FrimousseEmojiPicker.Search className="pp-input" placeholder="Buscar: fuego, aplauso…" />
        <FrimousseEmojiPicker.Viewport className="relative flex-1 overflow-y-auto outline-none">
          <FrimousseEmojiPicker.Loading
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: 'var(--pp-muted)' }}
          >
            Cargando…
          </FrimousseEmojiPicker.Loading>
          <FrimousseEmojiPicker.Empty
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: 'var(--pp-muted)' }}
          >
            Ningún emoji se llama así.
          </FrimousseEmojiPicker.Empty>
          <FrimousseEmojiPicker.List
            components={{ CategoryHeader, Row, Emoji: EmojiButton }}
            className="select-none"
          />
        </FrimousseEmojiPicker.Viewport>
        <div
          className="flex h-9 flex-none items-center gap-2 border-t pt-2"
          style={{ borderColor: 'var(--color-divider)' }}
        >
          <FrimousseEmojiPicker.ActiveEmoji>
            {({ emoji }) =>
              emoji ? (
                <>
                  <span className="text-xl leading-none">
                    <Emoji emoji={emoji.emoji} />
                  </span>
                  <span className="truncate text-xs" style={{ color: 'var(--color-text)' }}>
                    {emoji.label}
                  </span>
                </>
              ) : (
                <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
                  Toca uno para lanzarlo o reaccionar.
                </span>
              )
            }
          </FrimousseEmojiPicker.ActiveEmoji>
        </div>
      </FrimousseEmojiPicker.Root>
    </Modal>
  );
}

/** El mismo kicker que «Mirando desde la barrera»; con fondo, porque se queda pegado arriba. */
function CategoryHeader({
  category,
  style,
  ...props
}: EmojiPickerListCategoryHeaderProps): JSX.Element {
  return (
    // Su `style` trae el `position: sticky` de frimousse: se añade el fondo, no se sustituye.
    <div
      {...props}
      className="pp-kicker pb-2 pt-3"
      style={{ ...style, background: 'var(--color-surface)' }}
    >
      {category.label}
    </div>
  );
}

function Row({ children, ...props }: EmojiPickerListRowProps): JSX.Element {
  return (
    <div {...props} className="flex gap-1 pb-1">
      {children}
    </div>
  );
}

/** Como los botones de la barra de reacciones: radio de 9 px y el acento al pasar por encima. */
function EmojiButton({ emoji, style, ...props }: EmojiPickerListEmojiProps): JSX.Element {
  return (
    <button
      {...props}
      className="flex aspect-square flex-none items-center justify-center rounded-[9px] border text-[22px] leading-none"
      style={{
        ...style,
        // Ancho fijo y no `flex: 1`: en los resultados de una búsqueda la última fila no se llena,
        // y frimousse pone `display: flex` en cada fila, así que tampoco vale una rejilla.
        width: 'calc((100% - (var(--pp-emoji-columns) - 1) * 4px) / var(--pp-emoji-columns))',
        borderColor: emoji.isActive ? 'var(--color-accent)' : 'transparent',
        background: emoji.isActive
          ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
          : 'transparent',
      }}
    >
      <Emoji emoji={emoji.emoji} />
    </button>
  );
}
