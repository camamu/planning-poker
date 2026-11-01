import { readFileSync } from 'node:fs';
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicUrl = (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '');
  const version = releasedVersion();

  return {
    plugins: [react(), tailwindcss(), publicUrlInHtml(publicUrl)],
    define: version ? { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) } : {},
    server: { port: 5173 },
  };
});
