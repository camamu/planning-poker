import { InMemoryDeckRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryDeckRepository.js';
import { InMemoryGameRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryGameRepository.js';
import { InMemoryTeamRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryTeamRepository.js';
import { HmacTokenHasher } from '../../../src/infrastructure/security/HmacTokenHasher.js';
import { FixedClock } from './FixedClock.js';
import { RecordingEventPublisher } from './RecordingEventPublisher.js';
import { SequentialIdGenerator } from './SequentialIdGenerator.js';

export const NOW = new Date('2026-08-07T10:00:00Z');

export interface UseCaseContext {
  readonly games: InMemoryGameRepository;
  readonly decks: InMemoryDeckRepository;
  readonly teams: InMemoryTeamRepository;
  readonly hasher: HmacTokenHasher;
  readonly events: RecordingEventPublisher;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
}

export function makeContext(): UseCaseContext {
  return {
    games: new InMemoryGameRepository(),
    decks: new InMemoryDeckRepository(),
    teams: new InMemoryTeamRepository(),
    hasher: new HmacTokenHasher('test-session-secret'),
    events: new RecordingEventPublisher(),
    clock: new FixedClock(NOW),
    ids: new SequentialIdGenerator(),
  };
}
