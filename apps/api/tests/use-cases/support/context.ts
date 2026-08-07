import { InMemoryGameRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { FixedClock } from './FixedClock.js';
import { RecordingEventPublisher } from './RecordingEventPublisher.js';
import { SequentialIdGenerator } from './SequentialIdGenerator.js';

export const NOW = new Date('2026-08-07T10:00:00Z');

export interface UseCaseContext {
  readonly games: InMemoryGameRepository;
  readonly events: RecordingEventPublisher;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
}

export function makeContext(): UseCaseContext {
  return {
    games: new InMemoryGameRepository(),
    events: new RecordingEventPublisher(),
    clock: new FixedClock(NOW),
    ids: new SequentialIdGenerator(),
  };
}
