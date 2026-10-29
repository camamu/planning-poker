import { randomBytes } from 'node:crypto';
import type { SecretGenerator } from '../../application/ports/SecretGenerator.js';

/** 32 bytes del generador criptográfico del sistema: 256 bits, suficiente para una clave HMAC. */
export class RandomSecretGenerator implements SecretGenerator {
  generate(): string {
    return randomBytes(32).toString('hex');
  }
}
