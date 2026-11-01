import { DomainError } from '../shared/DomainError.js';
import type { WebhookEvent } from './WebhookEvent.js';
import type { WebhookId } from './WebhookId.js';
import type { WebhookUrl } from './WebhookUrl.js';

export class WebhookNeedsEventsError extends DomainError {
  constructor() {
    super('Un webhook necesita al menos un evento al que suscribirse.');
  }
}

export interface WebhookProps {
  readonly id: WebhookId;
  readonly url: WebhookUrl;
  readonly events: ReadonlyArray<WebhookEvent>;
  /**
   * Clave de la firma HMAC. Se guarda en claro porque hace falta para firmar cada envío: es un
   * secreto propio de la app y no una credencial de otro sistema (ADR 0028). Lo genera la api.
   */
  readonly secret: string;
}

export class Webhook {
  private constructor(
    readonly id: WebhookId,
    readonly url: WebhookUrl,
    readonly events: ReadonlyArray<WebhookEvent>,
    readonly secret: string,
  ) {}

  /** Un evento repetido en la lista cuenta una vez, en el orden en que llegó. */
  static create(props: WebhookProps): Webhook {
    const events = [...new Set(props.events)];
    if (events.length === 0) throw new WebhookNeedsEventsError();
    return new Webhook(props.id, props.url, events, props.secret);
  }

  static reconstitute(props: WebhookProps): Webhook {
    return new Webhook(props.id, props.url, props.events, props.secret);
  }

  isSubscribedTo(event: WebhookEvent): boolean {
    return this.events.includes(event);
  }
}
