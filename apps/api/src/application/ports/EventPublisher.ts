import type { GameEvent } from '../../domain/game/events/GameEvent.js';

export interface EventPublisher {
  publishAll(events: ReadonlyArray<GameEvent>): Promise<void>;
}
