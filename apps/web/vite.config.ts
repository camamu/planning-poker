import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { buildHeadersFile } from './build/securityHeaders.js';
import type { SecurityHeadersInput } from './build/securityHeaders.js';

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

/**
 * Cloudflare Workers aplica `_headers` a los assets estáticos. Se genera en el build y no es un
 * fichero fijo porque la CSP necesita el origen de la API, que es una variable de despliegue (ADR 0031).
 */
function securityHeadersFile(input: SecurityHeadersInput): Plugin {
  return {
    name: 'pp-security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: buildHeadersFile(input) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicUrl = (env.VITE_PUBLIC_URL ?? '').replace(/\/$/, '');
  const version = releasedVersion();

  return {
    plugins: [
      react(),
      tailwindcss(),
      publicUrlInHtml(publicUrl),
      securityHeadersFile({ apiUrl: env.VITE_API_URL, wsUrl: env.VITE_WS_URL }),
    ],
    define: version ? { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) } : {},
    server: { port: 5173 },
  };
});
