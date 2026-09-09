import type { Clock } from '../../../src/domain/shared/Clock.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}

  now(): Date {
    return this.fixed;
  }
}
