import { DomainError } from '../shared/DomainError.js';

/** `ping` no está aquí a propósito: se envía a mano desde la página del equipo y no se suscribe. */
export const WEBHOOK_EVENTS = ['issue.estimated', 'issues.imported', 'session.summary'] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class InvalidWebhookEventError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un evento de webhook conocido.`);
  }
}

export function parseWebhookEvent(raw: string): WebhookEvent {
  const known = WEBHOOK_EVENTS.find((event) => event === raw);
  if (known === undefined) throw new InvalidWebhookEventError(raw);
  return known;
}
