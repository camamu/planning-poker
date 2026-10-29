import type { CreatedWebhookView, WebhookView } from '@pp/contracts';
import type { Webhook } from '../../domain/team/Webhook.js';

/** Los listados solo enseñan los 4 últimos caracteres del secreto: el completo se ve una vez, al crearlo. */
const SECRET_HINT_LENGTH = 4;

export function toWebhookView(webhook: Webhook): WebhookView {
  return {
    id: webhook.id.value,
    url: webhook.url.value,
    events: webhook.events,
    secretHint: webhook.secret.slice(-SECRET_HINT_LENGTH),
  };
}

export function toCreatedWebhookView(webhook: Webhook): CreatedWebhookView {
  return { ...toWebhookView(webhook), secret: webhook.secret };
}
