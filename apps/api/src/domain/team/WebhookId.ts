import { DomainError } from '../shared/DomainError.js';

export class InvalidWebhookIdError extends DomainError {
  constructor(value: string) {
    super(`"${value}" no es un WebhookId válido: no puede estar vacío.`);
  }
}

export class WebhookId {
  private constructor(readonly value: string) {}

  static of(value: string): WebhookId {
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new InvalidWebhookIdError(value);
    return new WebhookId(trimmed);
  }

  equals(other: WebhookId): boolean {
    return this.value === other.value;
  }
}
