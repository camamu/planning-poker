import type { EventPublisher } from '../../application/ports/EventPublisher.js';
import type { GameEvent } from '../../domain/game/events/GameEvent.js';

/**
 * Reparte los eventos de dominio a su publicador principal (el de tiempo real) y, sin esperarlos, a
 * los de segundo plano (los webhooks, ADR 0028). Lo principal se espera y propaga sus errores; lo
 * de segundo plano nunca retrasa ni rompe la acción que lo provocó: la entrega con reintentos puede
 * tardar medio minuto y la acción ya está guardada. Sus errores van a `onBackgroundError`.
 */
export class CompositeEventPublisher implements EventPublisher {
  constructor(
    private readonly primary: EventPublisher,
    private readonly background: ReadonlyArray<EventPublisher>,
    private readonly onBackgroundError: (error: unknown) => void,
  ) {}

  async publishAll(events: ReadonlyArray<GameEvent>): Promise<void> {
    await this.primary.publishAll(events);
    for (const publisher of this.background) {
      void Promise.resolve()
        .then(() => publisher.publishAll(events))
        .catch(this.onBackgroundError);
    }
  }
}
