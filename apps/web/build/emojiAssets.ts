import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Connect, Plugin } from 'vite';

const require = createRequire(import.meta.url);

function packageDir(name: string): string {
  return dirname(require.resolve(`${name}/package.json`));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** La ruta pedida debajo de donde está montado el middleware, sin la barra inicial ni la query. */
function requestedFile(request: Connect.IncomingMessage): string {
  return (request.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
}

/** Lo que el selector de emojis pide de `emojibase-data`: nombres, etiquetas y categorías en español. */
const EMOJIBASE_FILES = ['es/data.json', 'es/messages.json'];

/**
 * Sirve los datos de los emojis desde la propia web, en `/emojibase/` (el `emojibaseUrl` de
 * `design-system/components/EmojiPicker`), en vez de que frimousse los pida a un CDN ajeno cada vez
 * que alguien abre el selector (ADR 0033). La versión la fija `emojibase-data` en package.json.
 */
export function selfHostedEmojibase(): Plugin {
  const root = packageDir('emojibase-data');
  const read = (file: string): Buffer => readFileSync(join(root, file));
  return {
    name: 'pp-emojibase',
    configureServer(server) {
      server.middlewares.use('/emojibase', (request, response, next) => {
        const file = requestedFile(request);
        if (!EMOJIBASE_FILES.includes(file)) {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/json');
        response.end(read(file));
      });
    },
    generateBundle() {
      for (const file of EMOJIBASE_FILES) {
        this.emitFile({ type: 'asset', fileName: `emojibase/${file}`, source: read(file) });
      }
    },
  };
}

/**
 * Cada dibujo de Fluent Emoji (plano) como un SVG suelto, con el nombre que le da `chars.json`: sus
 * puntos de código sin U+FE0F (`fluentEmojiKey` en `design-system/components/Emoji`). Los iconos de
 * Iconify son solo el cuerpo del SVG; unos pocos son el espejo de otro (`hFlip`).
 */
const POINTING_LEFT = '1f448';
const POINTING_RIGHT = '1f449';

function fluentEmojiFiles(): Map<string, string> {
  const root = packageDir('@iconify-json/fluent-emoji-flat');
  const set = readJson(join(root, 'icons.json'));
  const chars = readJson(join(root, 'chars.json'));
  if (!isRecord(set) || !isRecord(set.icons) || !isRecord(chars)) {
    throw new Error('@iconify-json/fluent-emoji-flat no tiene el formato de Iconify esperado');
  }
  const icons = set.icons;
  const aliases = isRecord(set.aliases) ? set.aliases : {};
  const size = typeof set.width === 'number' ? set.width : 32;

  const bodyOf = (name: string): string | undefined => {
    const icon = icons[name];
    if (isRecord(icon) && typeof icon.body === 'string') return icon.body;
    const alias = aliases[name];
    if (!isRecord(alias) || typeof alias.parent !== 'string') return undefined;
    const parent = bodyOf(alias.parent);
    if (parent === undefined || alias.hFlip !== true) return parent;
    return `<g transform="matrix(-1 0 0 1 ${size.toString()} 0)">${parent}</g>`;
  };

  const files = new Map<string, string>();
  const add = (key: string, body: string | undefined): void => {
    if (body === undefined) return;
    files.set(
      key,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.toString()} ${size.toString()}">${body}</svg>`,
    );
  };
  for (const [key, name] of Object.entries(chars)) {
    if (typeof name !== 'string') continue;
    add(key, bodyOf(name));
    // 👉 no está en chars.json: Fluent lo dibuja como espejo de 👈, también con cada tono de piel.
    if (key.startsWith(POINTING_LEFT)) {
      add(
        POINTING_RIGHT + key.slice(POINTING_LEFT.length),
        bodyOf(name.replace('pointing-left', 'pointing-right')),
      );
    }
  }
  return files;
}

/** Qué emojis tienen dibujo, para que el selector no ofrezca los que no (`FLUENT_EMOJI_INDEX`). */
const INDEX_FILE = 'index.json';

/**
 * Sirve los emojis de Fluent en `/emoji/<clave>.svg` (`FLUENT_EMOJI_URL`), para que se vean igual en
 * todos los dispositivos (ADR 0034). Uno por fichero: el navegador solo pide los que se ven y los
 * guarda en caché. El paquete pesa 9 MB, así que en desarrollo se lee la primera vez que hace falta.
 */
export function fluentEmoji(): Plugin {
  let files: Map<string, string> | undefined;
  const load = (): Map<string, string> => (files ??= fluentEmojiFiles());
  return {
    name: 'pp-fluent-emoji',
    configureServer(server) {
      server.middlewares.use('/emoji', (request, response, next) => {
        const file = requestedFile(request);
        if (file === INDEX_FILE) {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify([...load().keys()]));
          return;
        }
        if (!file.endsWith('.svg')) {
          next();
          return;
        }
        const svg = load().get(file.slice(0, -'.svg'.length));
        // Un 404 de verdad: el componente vuelve entonces al emoji del sistema.
        response.statusCode = svg === undefined ? 404 : 200;
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end(svg ?? '');
      });
    },
    generateBundle() {
      for (const [key, svg] of load()) {
        this.emitFile({ type: 'asset', fileName: `emoji/${key}.svg`, source: svg });
      }
      this.emitFile({
        type: 'asset',
        fileName: `emoji/${INDEX_FILE}`,
        source: JSON.stringify([...load().keys()]),
      });
    },
  };
}
