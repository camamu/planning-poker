import type { WebhookEnvelope } from '@pp/contracts';
import type { Webhook } from '../../domain/team/Webhook.js';
import type { WebhookRequest } from '../ports/WebhookSender.js';

/** Serializa una sola vez: la firma se calcula sobre exactamente el cuerpo que viaja. */
export function toWebhookRequest(webhook: Webhook, payload: WebhookEnvelope): WebhookRequest {
  return {
    url: webhook.url.value,
    secret: webhook.secret,
    event: payload.event,
    deliveryId: payload.deliveryId,
    body: JSON.stringify(payload),
  };
}
