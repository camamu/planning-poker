import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWebhook,
  deleteCustomDeck,
  listWebhooks,
  removeWebhook,
  testWebhook,
} from './teamsClient.js';

const fetchMock = vi.fn<typeof fetch>();

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  if (typeof url !== 'string') throw new Error('el cliente tiene que llamar con una URL en texto');
  return { url, init: init ?? {} };
}

function headersOf(init: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init.headers).entries());
}

describe('teamsClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('una petición sin cuerpo no manda content-type, que Fastify rechaza con un 400 si va vacío', async () => {
    await deleteCustomDeck('backend', 'tok', 'deck-1');

    const { url, init } = lastCall();
    expect(url).toContain('/api/teams/backend/decks/deck-1?k=tok');
    expect(init.method).toBe('DELETE');
    expect(headersOf(init)['content-type']).toBeUndefined();
  });

  it('una petición con cuerpo manda application/json', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'w1',
          url: 'https://x.example',
          events: [],
          secret: 's',
          secretHint: 's',
        }),
        { status: 201 },
      ),
    );

    await addWebhook('backend', 'tok', {
      url: 'https://hooks.example/a',
      events: ['issue.estimated'],
    });

    const { init } = lastCall();
    expect(headersOf(init)['content-type']).toBe('application/json');
    expect(init.body).toBe(
      JSON.stringify({ url: 'https://hooks.example/a', events: ['issue.estimated'] }),
    );
  });

  it('lista los webhooks con el token en la query', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

    await expect(listWebhooks('backend', 'tok')).resolves.toEqual([]);

    expect(lastCall().url).toContain('/api/teams/backend/webhooks?k=tok');
  });

  it('borrar un webhook es un DELETE sin cuerpo ni content-type', async () => {
    await expect(removeWebhook('backend', 'tok', 'w1')).resolves.toBeUndefined();

    const { url, init } = lastCall();
    expect(url).toContain('/api/teams/backend/webhooks/w1?k=tok');
    expect(init.method).toBe('DELETE');
    expect(headersOf(init)['content-type']).toBeUndefined();
  });

  it('enviar una prueba es un POST sin cuerpo ni content-type y devuelve el resultado', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: 200, error: null }), { status: 200 }),
    );

    const result = await testWebhook('backend', 'tok', 'w1');

    expect(result).toEqual({ ok: true, status: 200, error: null });
    const { url, init } = lastCall();
    expect(url).toContain('/api/teams/backend/webhooks/w1/test?k=tok');
    expect(init.method).toBe('POST');
    expect(headersOf(init)['content-type']).toBeUndefined();
  });

  it('lanza el mensaje del servidor cuando la petición falla', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Un equipo no puede tener más de 3 webhooks.' }), {
        status: 422,
      }),
    );

    await expect(
      addWebhook('backend', 'tok', { url: 'https://hooks.example/a', events: ['issue.estimated'] }),
    ).rejects.toThrow('Un equipo no puede tener más de 3 webhooks.');
  });
});
