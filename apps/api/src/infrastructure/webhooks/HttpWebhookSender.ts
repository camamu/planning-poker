import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type {
  WebhookOutcome,
  WebhookRequest,
  WebhookSendOptions,
  WebhookSender,
} from '../../application/ports/WebhookSender.js';
import { signWebhookBody } from '../security/webhookSignature.js';
import { isPublicAddress } from './publicAddress.js';

const DEFAULT_TIMEOUT_MS = 5_000;
/** Espera antes de cada reintento: 1 s, 5 s y 25 s (ADR 0028). */
const DEFAULT_RETRY_DELAYS_MS: ReadonlyArray<number> = [1_000, 5_000, 25_000];
const USER_AGENT = 'planning-poker-webhooks/1';

export interface HttpWebhookSenderOptions {
  readonly timeoutMs?: number;
  readonly retryDelaysMs?: ReadonlyArray<number>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
  /**
   * Solo para probar contra un servidor local. En producción se queda en los valores por defecto:
   * solo `https` y solo direcciones públicas.
   */
  readonly allowHttp?: boolean;
  readonly isAllowedAddress?: (address: string) => boolean;
}

type Attempt =
  | { readonly kind: 'delivered'; readonly status: number }
  | { readonly kind: 'retry'; readonly status: number | null; readonly reason: string }
  | { readonly kind: 'rejected'; readonly status: number | null; readonly reason: string };

class BlockedDestinationError extends Error {
  constructor() {
    super('destino no permitido: apunta a una red privada o reservada');
    this.name = 'BlockedDestinationError';
  }
}

/**
 * Entrega webhooks con `node:http(s)` y no con `fetch` porque la protección SSRF tiene que ocurrir
 * en la conexión: el `lookup` valida las direcciones que devuelve el DNS y la conexión se abre a esa
 * misma dirección, así que un nombre que cambie de respuesta entre la comprobación y el envío
 * (DNS rebinding) no se cuela. Con `fetch` solo se podría comprobar antes y volver a resolver
 * después. Tampoco sigue redirecciones: un 3xx cuenta como fallo.
 */
export class HttpWebhookSender implements WebhookSender {
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: ReadonlyArray<number>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly allowHttp: boolean;
  private readonly isAllowedAddress: (address: string) => boolean;

  constructor(options: HttpWebhookSenderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.sleep =
      options.sleep ??
      ((ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }));
    this.now = options.now ?? (() => new Date());
    this.allowHttp = options.allowHttp ?? false;
    this.isAllowedAddress = options.isAllowedAddress ?? isPublicAddress;
  }

  async send(request: WebhookRequest, options: WebhookSendOptions): Promise<WebhookOutcome> {
    const maxAttempts = options.retry ? this.retryDelaysMs.length + 1 : 1;
    let attempts = 0;

    for (;;) {
      attempts += 1;
      const result = await this.attempt(request);
      if (result.kind === 'delivered') {
        return { delivered: true, status: result.status, attempts };
      }
      if (result.kind === 'rejected' || attempts >= maxAttempts) {
        const reason =
          attempts > 1 ? `${result.reason} tras ${attempts.toString()} intentos` : result.reason;
        return { delivered: false, status: result.status, reason, attempts };
      }
      await this.sleep(this.retryDelaysMs[attempts - 1] ?? 0);
    }
  }

  private async attempt(request: WebhookRequest): Promise<Attempt> {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return { kind: 'rejected', status: null, reason: 'la URL no es válida' };
    }
    if (url.protocol !== 'https:' && !(this.allowHttp && url.protocol === 'http:')) {
      return { kind: 'rejected', status: null, reason: 'solo se admiten URLs https' };
    }
    // Una IP escrita en la URL no pasa por el DNS: el `lookup` no se ejecuta, así que se mira aquí.
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(literal) !== 0 && !this.isAllowedAddress(literal)) {
      return { kind: 'rejected', status: null, reason: new BlockedDestinationError().message };
    }
    return this.post(url, request);
  }

  private post(url: URL, request: WebhookRequest): Promise<Attempt> {
    return new Promise((resolve) => {
      const timestamp = Math.floor(this.now().getTime() / 1000).toString();
      const transport = url.protocol === 'https:' ? https : http;
      const outgoing = transport.request(
        url,
        {
          method: 'POST',
          lookup: this.lookup,
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(request.body),
            'User-Agent': USER_AGENT,
            'X-PP-Event': request.event,
            'X-PP-Delivery': request.deliveryId,
            'X-PP-Timestamp': timestamp,
            'X-PP-Signature': signWebhookBody(request.secret, timestamp, request.body),
          },
        },
        (response) => {
          response.resume();
          resolve(fromStatus(response.statusCode ?? 0));
        },
      );
      outgoing.on('error', (error) => {
        resolve(fromError(error));
      });
      outgoing.end(request.body);
    });
  }

  private readonly lookup: LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, '', 0);
        return;
      }
      const [first] = addresses;
      // Basta una dirección privada entre las respuestas para rechazar el nombre entero.
      if (!first || !addresses.every((candidate) => this.isAllowedAddress(candidate.address))) {
        callback(new BlockedDestinationError(), '', 0);
        return;
      }
      if (options.all) callback(null, addresses);
      else callback(null, first.address, first.family);
    });
  };
}

function fromStatus(status: number): Attempt {
  if (status >= 200 && status < 300) return { kind: 'delivered', status };
  if (status >= 300 && status < 400) {
    return {
      kind: 'rejected',
      status,
      reason: `HTTP ${status.toString()}: no se siguen redirecciones`,
    };
  }
  if (status >= 400 && status < 500) {
    return { kind: 'rejected', status, reason: `HTTP ${status.toString()}` };
  }
  return { kind: 'retry', status, reason: `HTTP ${status.toString()}` };
}

function fromError(error: Error): Attempt {
  if (error instanceof BlockedDestinationError) {
    return { kind: 'rejected', status: null, reason: error.message };
  }
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return { kind: 'retry', status: null, reason: 'tiempo de espera agotado' };
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : error.message;
  return { kind: 'retry', status: null, reason: `error de red (${code})` };
}
