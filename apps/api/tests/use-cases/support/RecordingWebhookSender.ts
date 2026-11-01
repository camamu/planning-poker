import { webhookEnvelopeSchema } from '@pp/contracts';
import type { WebhookEnvelope } from '@pp/contracts';
import type {
  WebhookOutcome,
  WebhookRequest,
  WebhookSendOptions,
  WebhookSender,
} from '../../../src/application/ports/WebhookSender.js';

const DELIVERED: WebhookOutcome = { delivered: true, status: 200, attempts: 1 };

/** Guarda lo que se envía y contesta lo que cada test decida; por defecto, entregado. */
export class RecordingWebhookSender implements WebhookSender {
  readonly sent: Array<{ request: WebhookRequest; options: WebhookSendOptions }> = [];

  constructor(
    private readonly respond: (request: WebhookRequest) => WebhookOutcome = () => DELIVERED,
  ) {}

  send(request: WebhookRequest, options: WebhookSendOptions): Promise<WebhookOutcome> {
    this.sent.push({ request, options });
    return Promise.resolve(this.respond(request));
  }

  /** El cuerpo de cada envío, ya interpretado: si alguno no cumple el contrato, el test falla aquí. */
  bodies(): WebhookEnvelope[] {
    return this.sent.map(({ request }) => webhookEnvelopeSchema.parse(JSON.parse(request.body)));
  }
}

export const FAILED_DELIVERY: WebhookOutcome = {
  delivered: false,
  status: 503,
  reason: 'HTTP 503 tras 4 intentos',
  attempts: 4,
};
