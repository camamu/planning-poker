import { createHmac } from 'node:crypto';

/**
 * Valor de `X-PP-Signature`: HMAC-SHA256 de `"<timestamp>.<cuerpo>"` con el secreto del webhook,
 * en hexadecimal y con el prefijo `sha256=` (ADR 0028). Incluir la marca de tiempo en lo firmado
 * deja al receptor rechazar un envío repetido pasado un margen (5 minutos).
 */
export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `sha256=${digest}`;
}
