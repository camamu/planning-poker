import type { IdGenerator } from '../../../src/application/ports/IdGenerator.js';

export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `id-${this.count.toString()}`;
  }
}
