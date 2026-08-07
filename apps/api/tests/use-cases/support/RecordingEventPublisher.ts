import type { GameEvent } from '../../../src/domain/game/events/GameEvent.js';
import type { EventPublisher } from '../../../src/application/ports/EventPublisher.js';

export class RecordingEventPublisher implements EventPublisher {
  readonly published: GameEvent[] = [];

  publishAll(events: ReadonlyArray<GameEvent>): Promise<void> {
    this.published.push(...events);
    return Promise.resolve();
  }

  clear(): void {
    this.published.length = 0;
  }
}
