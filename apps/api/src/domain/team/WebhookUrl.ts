import { DomainError } from '../shared/DomainError.js';

export class InvalidWebhookUrlError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es una URL válida para un webhook.`);
  }
}

export class InsecureWebhookUrlError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es https: un webhook solo admite URLs https.`);
  }
}

/**
 * Solo `https`: el cuerpo viaja firmado, pero la firma no cifra nada y la URL de un receptor suele
 * llevar un secreto propio. Que la dirección no apunte a la red interna es asunto de
 * infraestructura, que es quien resuelve el DNS (ADR 0028); aquí solo se mira la forma.
 */
export class WebhookUrl {
  private constructor(readonly value: string) {}

  static of(raw: string): WebhookUrl {
    const trimmed = raw.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new InvalidWebhookUrlError(raw);
    }
    if (parsed.protocol !== 'https:') throw new InsecureWebhookUrlError(raw);
    return new WebhookUrl(trimmed);
  }
}
