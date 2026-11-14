export interface SecurityHeadersInput {
  /** `VITE_API_URL`: el origen al que la web hace `fetch`. */
  readonly apiUrl: string | undefined;
  /** `VITE_WS_URL`: el origen del Socket.IO. Suele ser el mismo que el de la API. */
  readonly wsUrl: string | undefined;
}

/**
 * Los orígenes a los que la web puede conectar. Una fuente `https://host` no cubre `wss://host`
 * (CSP compara el esquema), así que se listan los dos. Una URL que no se pueda leer se ignora: el
 * build no debe romperse por una variable mal escrita, y sin ese origen la web ya fallaría igual.
 */
function connectSources(urls: ReadonlyArray<string | undefined>): string[] {
  const sources = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    try {
      const { protocol, host } = new URL(raw);
      if (protocol === 'https:') {
        sources.add(`https://${host}`);
        sources.add(`wss://${host}`);
      } else if (protocol === 'http:') {
        sources.add(`http://${host}`);
        sources.add(`ws://${host}`);
      }
    } catch {
      continue;
    }
  }
  return [...sources];
}

/**
 * `script-src 'self'`, sin `unsafe-inline` ni `unsafe-eval`: es la directiva que frena un XSS.
 * `style-src` sí admite `unsafe-inline` por los `style=` de React, y Google Fonts por la tipografía
 * (`index.html`). El resto de recursos son propios.
 */
export function buildContentSecurityPolicy(input: SecurityHeadersInput): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    ['connect-src', "'self'", ...connectSources([input.apiUrl, input.wsUrl])].join(' '),
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ];
  return directives.join('; ');
}

/**
 * El contenido de `_headers`, que Cloudflare Workers con assets aplica a cada respuesta estática
 * (ADR 0031). `Referrer-Policy: no-referrer` porque las URLs de partida y de equipo (`?k=`) son
 * credenciales y un enlace de tarea hacia Jira no debe llevárselas.
 */
export function buildHeadersFile(input: SecurityHeadersInput): string {
  return [
    '/*',
    `  Content-Security-Policy: ${buildContentSecurityPolicy(input)}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    '  Strict-Transport-Security: max-age=15552000',
    '',
  ].join('\n');
}
