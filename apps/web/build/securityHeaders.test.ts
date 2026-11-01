import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, buildHeadersFile } from './securityHeaders.js';

const API = 'https://pp-api.onrender.com';

function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((entry) => entry.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('cabeceras de seguridad de la web (ADR 0031)', () => {
  it('solo permite scripts propios: ni unsafe-inline ni unsafe-eval', () => {
    const scripts = directive(
      buildContentSecurityPolicy({ apiUrl: API, wsUrl: API }),
      'script-src',
    );

    expect(scripts).toEqual(["'self'"]);
  });

  it('permite conectar a la API por https y por wss: una fuente https no cubre wss', () => {
    const connect = directive(
      buildContentSecurityPolicy({ apiUrl: API, wsUrl: API }),
      'connect-src',
    );

    expect(connect).toEqual(["'self'", API, 'wss://pp-api.onrender.com']);
  });

  it('en un build local con http permite http y ws', () => {
    const connect = directive(
      buildContentSecurityPolicy({
        apiUrl: 'http://localhost:3000',
        wsUrl: 'http://localhost:3000',
      }),
      'connect-src',
    );

    expect(connect).toEqual(["'self'", 'http://localhost:3000', 'ws://localhost:3000']);
  });

  it('lista cada origen una vez y admite una API y un socket en sitios distintos', () => {
    const connect = directive(
      buildContentSecurityPolicy({ apiUrl: API, wsUrl: 'https://ws.example.com/' }),
      'connect-src',
    );

    expect(connect).toEqual([
      "'self'",
      API,
      'wss://pp-api.onrender.com',
      'https://ws.example.com',
      'wss://ws.example.com',
    ]);
  });

  it('sin URL de API, o con una ilegible, solo permite conectar al propio origen', () => {
    for (const apiUrl of [undefined, '', 'esto no es una url', 'ftp://host']) {
      const policy = buildContentSecurityPolicy({ apiUrl, wsUrl: undefined });

      expect(directive(policy, 'connect-src')).toEqual(["'self'"]);
    }
  });

  it('no deja incrustar la web en otra página ni cargar plugins', () => {
    const policy = buildContentSecurityPolicy({ apiUrl: API, wsUrl: API });

    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
  });

  it('solo abre el exterior para la tipografía de Google Fonts', () => {
    const policy = buildContentSecurityPolicy({ apiUrl: API, wsUrl: API });

    expect(directive(policy, 'style-src')).toContain('https://fonts.googleapis.com');
    expect(directive(policy, 'font-src')).toEqual(['https://fonts.gstatic.com']);
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
  });

  it('el _headers aplica a todas las rutas y no envía el Referer: las URLs de partida son credenciales', () => {
    const file = buildHeadersFile({ apiUrl: API, wsUrl: API });

    expect(file.startsWith('/*\n')).toBe(true);
    expect(file).toContain('  Referrer-Policy: no-referrer\n');
    expect(file).toContain('  X-Content-Type-Options: nosniff\n');
    expect(file).toContain('  Content-Security-Policy: default-src');
    expect(file.endsWith('\n')).toBe(true);
  });
});
