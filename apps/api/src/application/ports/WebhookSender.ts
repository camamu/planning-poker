import type { WebhookEventName } from '@pp/contracts';

export interface WebhookRequest {
  readonly url: string;
  /** Clave de la firma HMAC del webhook. */
  readonly secret: string;
  readonly event: WebhookEventName | 'ping';
  readonly deliveryId: string;
  /** El cuerpo ya serializado: la firma se calcula sobre exactamente estos bytes. */
  readonly body: string;
}

export type WebhookOutcome =
  | { readonly delivered: true; readonly status: number; readonly attempts: number }
  | {
      readonly delivered: false;
      /** `null` si el receptor no llegó a contestar. */
      readonly status: number | null;
      readonly reason: string;
      readonly attempts: number;
    };

export interface WebhookSendOptions {
  /** Reintentar ante un fallo de red o un 5xx. Las pruebas manuales piden una sola entrega. */
  readonly retry: boolean;
}

/**
 * Entrega un cuerpo a una URL externa (ADR 0028). Nunca lanza por un fallo de entrega: lo cuenta en
 * el resultado, porque quien llama (un evento de dominio ya persistido) no debe romperse por él.
 */
export interface WebhookSender {
  send(request: WebhookRequest, options: WebhookSendOptions): Promise<WebhookOutcome>;
}
