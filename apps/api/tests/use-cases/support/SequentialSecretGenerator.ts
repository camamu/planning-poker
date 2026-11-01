import type { SecretGenerator } from '../../../src/application/ports/SecretGenerator.js';

export class SequentialSecretGenerator implements SecretGenerator {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `secreto-de-prueba-${this.count.toString().padStart(4, '0')}`;
  }
}
