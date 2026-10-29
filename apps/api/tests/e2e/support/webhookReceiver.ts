import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { WebhookSender } from '../../../src/application/ports/WebhookSender.js';
import { HttpWebhookSender } from '../../../src/infrastructure/webhooks/HttpWebhookSender.js';

export interface Delivery {
  readonly path: string;
  readonly headers: http.IncomingHttpHeaders;
  readonly body: string;
}

export interface Receiver {
  readonly port: number;
  readonly deliveries: Delivery[];
  /** Con qué código contesta a partir de ahora (por defecto 200). */
  respondWith(status: number): void;
  close(): Promise<void>;
}

/** Un receptor de webhooks local: guarda cada petición y contesta el código que se le pida. */
export async function startReceiver(): Promise<Receiver> {
  const deliveries: Delivery[] = [];
  let status = 200;
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      deliveries.push({
        path: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.writeHead(status).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('el receptor no tiene puerto');

  return {
    port: address.port,
    deliveries,
    respondWith: (next) => {
      status = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** La URL con la que se da de alta el webhook en los tests: https, como exige el dominio. */
export const TEST_HOOK_ORIGIN = 'https://hooks.test';

/**
 * El sender real de la api, con la protección SSRF y el https obligatorio relajados y reintentos de
 * milisegundos, que reenvía `https://hooks.test/...` al receptor local. Todo lo demás (firma,
 * cabeceras, reintentos, clasificación de respuestas) es el código de producción.
 */
export function senderTo(
  receiver: Receiver,
  retryDelaysMs: ReadonlyArray<number> = [5, 5, 5],
): WebhookSender {
  const real = new HttpWebhookSender({
    allowHttp: true,
    isAllowedAddress: () => true,
    retryDelaysMs,
  });
  return {
    send: (request, options) =>
      real.send(
        {
          ...request,
          url: request.url.replace(
            TEST_HOOK_ORIGIN,
            `http://127.0.0.1:${receiver.port.toString()}`,
          ),
        },
        options,
      ),
  };
}

/** Lo que haría el receptor para comprobar un envío: la firma sobre «timestamp.cuerpo» con su secreto. */
export function hasValidSignature(delivery: Delivery, secret: string): boolean {
  const timestamp = delivery.headers['x-pp-timestamp'];
  if (typeof timestamp !== 'string') return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${delivery.body}`)
    .digest('hex');
  return delivery.headers['x-pp-signature'] === `sha256=${expected}`;
}
