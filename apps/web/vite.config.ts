import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

/** La versión que release-please acaba de cortar; el pie de la portada la enseña (ADR 0029). */
function releasedVersion(): string | undefined {
  try {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL('../../.release-please-manifest.json', import.meta.url), 'utf8'),
    );
    if (typeof manifest !== 'object' || manifest === null || !('.' in manifest)) return undefined;
    const version = manifest['.'];
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Slack y Teams solo pintan la imagen de Open Graph con una URL absoluta. Sin `VITE_PUBLIC_URL`
 * queda relativa, que basta en local y para los lectores que sí la resuelven.
 */
function publicUrlInHtml(publicUrl: string): Plugin {
  return {
    name: 'pp-public-url',
    transformIndexHtml: (html) => html.replaceAll('%PP_PUBLIC_URL%', publicUrl),
  };
}

/** Lo que el selector de emojis pide de `emojibase-data`: nombres, etiquetas y categorías en español. */
const EMOJIBASE_FILES = ['es/data.json', 'es/messages.json'];

/**
 * Sirve los datos de los emojis desde la propia web, en `/emojibase/` (el `emojibaseUrl` de
 * `design-system/components/EmojiPicker`), en vez de que frimousse los pida a un CDN ajeno cada vez
 * que alguien abre el selector. La versión la fija `emojibase-data` en package.json.
 */
function selfHostedEmojibase(): Plugin {
  const root = dirname(createRequire(import.meta.url).resolve('emojibase-data/package.json'));
  const read = (file: string): Buffer => readFileSync(join(root, file));
  return {
    name: 'pp-emojibase',
    configureServer(server) {
      server.middlewares.use('/emojibase', (request, response, next) => {
        const file = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicUrl = (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '');
  const version = releasedVersion();

  return {
    plugins: [react(), tailwindcss(), publicUrlInHtml(publicUrl), selfHostedEmojibase()],
    define: version ? { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) } : {},
    server: { port: 5173 },
  };
});
