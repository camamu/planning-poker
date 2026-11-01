import { createHmac } from 'node:crypto';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebhookRequest } from '../../src/application/ports/WebhookSender.js';
import { HttpWebhookSender } from '../../src/infrastructure/webhooks/HttpWebhookSender.js';
import type { HttpWebhookSenderOptions } from '../../src/infrastructure/webhooks/HttpWebhookSender.js';

interface Received {
  readonly headers: http.IncomingHttpHeaders;
  readonly body: string;
}

interface LocalServer {
  readonly url: string;
  readonly port: number;
  readonly received: Received[];
}

type Handler = (request: Received, response: http.ServerResponse, count: number) => void;

const servers: http.Server[] = [];

/** Un receptor local que guarda lo que le llega y contesta lo que cada test decida. */
async function listen(handler: Handler): Promise<LocalServer> {
  const received: Received[] = [];
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const entry = { headers: request.headers, body: Buffer.concat(chunks).toString('utf8') };
      received.push(entry);
      handler(entry, response, received.length);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('el servidor no tiene puerto');
  const { port } = address;
  return { url: `http://127.0.0.1:${port.toString()}/hook`, port, received };
}

function status(code: number): Handler {
  return (_request, response) => {
    response.writeHead(code).end();
  };
}

const NOW = new Date('2026-08-07T10:00:00Z');
const REQUEST: WebhookRequest = {
  url: 'http://127.0.0.1:1/hook',
  secret: 'secreto-del-webhook',
  event: 'issue.estimated',
  deliveryId: 'entrega-1',
  body: '{"version":1,"event":"issue.estimated"}',
};

/** Sin esperar de verdad entre reintentos, con una hora fija y apuntando a un servidor http local. */
function testOptions(slept: number[]): HttpWebhookSenderOptions {
  return {
    allowHttp: true,
    now: () => NOW,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
  };
}

/** Acepta cualquier dirección: para probar la entrega sin que la protección SSRF lo impida. */
function localSender(options: HttpWebhookSenderOptions = {}): {
  sender: HttpWebhookSender;
  slept: number[];
} {
  const slept: number[] = [];
  const sender = new HttpWebhookSender({
    ...testOptions(slept),
    isAllowedAddress: () => true,
    ...options,
  });
  return { sender, slept };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
});

describe('HttpWebhookSender: firma y cabeceras', () => {
  it('entrega el cuerpo con una firma que el receptor puede verificar con el secreto', async () => {
    const receiver = await listen(status(200));
    const { sender } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toEqual({ delivered: true, status: 200, attempts: 1 });
    const [delivery] = receiver.received;
    const timestamp = Math.floor(NOW.getTime() / 1000).toString();
    const expected = createHmac('sha256', REQUEST.secret)
      .update(`${timestamp}.${REQUEST.body}`)
      .digest('hex');
    expect(delivery?.body).toBe(REQUEST.body);
    expect(delivery?.headers['x-pp-signature']).toBe(`sha256=${expected}`);
    expect(delivery?.headers['x-pp-timestamp']).toBe(timestamp);
  });

  it('lleva el evento, el identificador de entrega y el tipo de contenido', async () => {
    const receiver = await listen(status(204));
    const { sender } = localSender();

    await sender.send({ ...REQUEST, url: receiver.url }, { retry: false });

    const headers = receiver.received[0]?.headers;
    expect(headers?.['x-pp-event']).toBe('issue.estimated');
    expect(headers?.['x-pp-delivery']).toBe('entrega-1');
    expect(headers?.['content-type']).toBe('application/json');
    expect(headers?.['content-length']).toBe(Buffer.byteLength(REQUEST.body).toString());
    expect(headers?.['user-agent']).toBe('planning-poker-webhooks/1');
  });

  it('una firma calculada con otro secreto no coincide', async () => {
    const receiver = await listen(status(200));
    const { sender } = localSender();

    await sender.send({ ...REQUEST, url: receiver.url }, { retry: false });

    const timestamp = Math.floor(NOW.getTime() / 1000).toString();
    const forged = createHmac('sha256', 'otro-secreto')
      .update(`${timestamp}.${REQUEST.body}`)
      .digest('hex');
    expect(receiver.received[0]?.headers['x-pp-signature']).not.toBe(`sha256=${forged}`);
  });
});

describe('HttpWebhookSender: reintentos', () => {
  it('reintenta ante un 503 y entrega cuando el receptor se recupera, esperando 1 s y 5 s', async () => {
    const receiver = await listen((_request, response, count) => {
      response.writeHead(count < 3 ? 503 : 200).end();
    });
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toEqual({ delivered: true, status: 200, attempts: 3 });
    expect(receiver.received).toHaveLength(3);
    expect(slept).toEqual([1_000, 5_000]);
  });

  it('agota los reintentos ante un 503 constante: cuatro intentos y esperas de 1, 5 y 25 s', async () => {
    const receiver = await listen(status(503));
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toEqual({
      delivered: false,
      status: 503,
      reason: 'HTTP 503 tras 4 intentos',
      attempts: 4,
    });
    expect(slept).toEqual([1_000, 5_000, 25_000]);
  });

  it('no reintenta ante un 400: el receptor ya ha dicho que no', async () => {
    const receiver = await listen(status(400));
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toEqual({ delivered: false, status: 400, reason: 'HTTP 400', attempts: 1 });
    expect(receiver.received).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it('con retry desactivado hace una sola entrega aunque el fallo sea reintentable', async () => {
    const receiver = await listen(status(503));
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: false });

    expect(outcome).toMatchObject({ delivered: false, status: 503, attempts: 1 });
    expect(receiver.received).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it('reintenta un fallo de red, como un puerto cerrado', async () => {
    const closed = await listen(status(200));
    const url = closed.url;
    await new Promise<void>((resolve) => {
      for (const server of servers.splice(0)) {
        server.close(() => {
          resolve();
        });
      }
    });
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 4 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('ECONNREFUSED');
    expect(slept).toEqual([1_000, 5_000, 25_000]);
  });

  it('reintenta cuando el receptor no contesta a tiempo', async () => {
    const receiver = await listen(() => undefined);
    const { sender, slept } = localSender({ timeoutMs: 80 });

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 4 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('tiempo de espera agotado');
    expect(slept).toHaveLength(3);
  });
});

describe('HttpWebhookSender: sin redirecciones', () => {
  it('no sigue una redirección: un 3xx es un fallo y el destino no recibe nada', async () => {
    const target = await listen(status(200));
    const redirecting = await listen((_request, response) => {
      response.writeHead(302, { Location: target.url }).end();
    });
    const { sender, slept } = localSender();

    const outcome = await sender.send({ ...REQUEST, url: redirecting.url }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: 302, attempts: 1 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('no se siguen redirecciones');
    expect(target.received).toEqual([]);
    expect(slept).toEqual([]);
  });
});

describe('HttpWebhookSender: protección SSRF', () => {
  /** Con la política de direcciones por defecto: solo se relaja http para poder usar un receptor local. */
  function strictSender(): { sender: HttpWebhookSender; slept: number[] } {
    const slept: number[] = [];
    return { sender: new HttpWebhookSender(testOptions(slept)), slept };
  }

  it('rechaza 127.0.0.1 y el receptor no llega a recibir nada', async () => {
    const receiver = await listen(status(200));
    const { sender, slept } = strictSender();

    const outcome = await sender.send({ ...REQUEST, url: receiver.url }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 1 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('destino no permitido');
    expect(receiver.received).toEqual([]);
    expect(slept).toEqual([]);
  });

  it('rechaza un nombre que resuelve a una IP privada (localhost) sin conectar', async () => {
    const receiver = await listen(status(200));
    const { sender } = strictSender();

    const outcome = await sender.send(
      { ...REQUEST, url: `http://localhost:${receiver.port.toString()}/hook` },
      { retry: true },
    );

    expect(outcome).toMatchObject({ delivered: false, attempts: 1 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('destino no permitido');
    expect(receiver.received).toEqual([]);
  });

  it.each([
    ['http://10.0.0.5/hook', '10.0.0.0/8'],
    ['http://169.254.169.254/latest/meta-data', 'los metadatos de la nube'],
    ['http://192.168.1.1/hook', '192.168.0.0/16'],
    ['http://[::1]:8080/hook', 'el loopback IPv6'],
    ['http://[::ffff:127.0.0.1]:8080/hook', 'IPv4 de loopback empaquetado en IPv6'],
  ])('rechaza %s (%s) sin intentar conectar', async (url) => {
    const { sender, slept } = strictSender();

    const outcome = await sender.send({ ...REQUEST, url }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 1 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('destino no permitido');
    expect(slept).toEqual([]);
  });

  it('con https obligatorio por defecto, rechaza http aunque la dirección sea pública', async () => {
    const sender = new HttpWebhookSender();

    const outcome = await sender.send(
      { ...REQUEST, url: 'http://93.184.216.34/hook' },
      { retry: true },
    );

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 1 });
    expect(outcome.delivered ? '' : outcome.reason).toContain('solo se admiten URLs https');
  });

  it('rechaza una URL que no es una URL', async () => {
    const { sender } = strictSender();

    const outcome = await sender.send({ ...REQUEST, url: 'no es una url' }, { retry: true });

    expect(outcome).toMatchObject({ delivered: false, status: null, attempts: 1 });
  });
});
