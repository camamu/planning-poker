import { DomainError } from '../shared/DomainError.js';
import type { TeamId } from './TeamId.js';
import type { TeamName } from './TeamName.js';
import type { TeamSlug } from './TeamSlug.js';
import { Webhook } from './Webhook.js';
import type { WebhookEvent } from './WebhookEvent.js';
import type { WebhookId } from './WebhookId.js';
import type { WebhookUrl } from './WebhookUrl.js';

/** Cada webhook es una URL más a la que la api llama por cada estimación (ADR 0028). */
export const MAX_WEBHOOKS_PER_TEAM = 3;

export class TooManyWebhooksError extends DomainError {
  constructor() {
    super(`Un equipo no puede tener más de ${MAX_WEBHOOKS_PER_TEAM.toString()} webhooks.`);
  }
}

export class WebhookNotFoundError extends DomainError {
  constructor(readonly webhookId: WebhookId) {
    super(`No existe el webhook ${webhookId.value} en este equipo.`);
  }
}

export interface TeamProps {
  readonly id: TeamId;
  readonly slug: TeamSlug;
  readonly name: TeamName;
  /** Hash del token de acceso (calculado por `TokenHasher`, puerto de `application/`) — el dominio nunca ve el secreto en claro. */
  readonly tokenHash: string;
  /** Ausente = sin webhooks. */
  readonly webhooks?: ReadonlyArray<Webhook> | undefined;
}

/**
 * Sin registro ni cuentas (docs/02-decisiones-y-plan.md §2): un `Team` es solo el ámbito al que
 * cuelgan las barajas personalizadas, identificado por `slug` en la URL y protegido por un token
 * de un solo reparto (se muestra una vez al crearlo, igual que el link de facilitador de `Game`).
 */
export class Team {
  private constructor(
    readonly id: TeamId,
    readonly slug: TeamSlug,
    readonly name: TeamName,
    readonly tokenHash: string,
    readonly webhooks: ReadonlyArray<Webhook>,
  ) {}

  static create(props: TeamProps): Team {
    return new Team(props.id, props.slug, props.name, props.tokenHash, props.webhooks ?? []);
  }

  static reconstitute(props: TeamProps): Team {
    return new Team(props.id, props.slug, props.name, props.tokenHash, props.webhooks ?? []);
  }

  /** El slug no cambia al renombrar: es lo que llevan los enlaces ya repartidos. */
  rename(name: TeamName): Team {
    return new Team(this.id, this.slug, name, this.tokenHash, this.webhooks);
  }

  /** Sustituye el token de acceso: el enlace anterior deja de resolver en cuanto se persiste. */
  rotateToken(tokenHash: string): Team {
    return new Team(this.id, this.slug, this.name, tokenHash, this.webhooks);
  }

  addWebhook(
    id: WebhookId,
    url: WebhookUrl,
    events: ReadonlyArray<WebhookEvent>,
    secret: string,
  ): Team {
    if (this.webhooks.length >= MAX_WEBHOOKS_PER_TEAM) throw new TooManyWebhooksError();
    const webhook = Webhook.create({ id, url, events, secret });
    return new Team(this.id, this.slug, this.name, this.tokenHash, [...this.webhooks, webhook]);
  }

  removeWebhook(id: WebhookId): Team {
    if (!this.findWebhook(id)) throw new WebhookNotFoundError(id);
    const remaining = this.webhooks.filter((webhook) => !webhook.id.equals(id));
    return new Team(this.id, this.slug, this.name, this.tokenHash, remaining);
  }

  findWebhook(id: WebhookId): Webhook | undefined {
    return this.webhooks.find((webhook) => webhook.id.equals(id));
  }

  webhooksFor(event: WebhookEvent): ReadonlyArray<Webhook> {
    return this.webhooks.filter((webhook) => webhook.isSubscribedTo(event));
  }

  hasTokenHash(candidateHash: string): boolean {
    return this.tokenHash === candidateHash;
  }
}
