import { createHmac } from 'node:crypto';
import type { TokenHasher } from '../../application/ports/TokenHasher.js';

/** HMAC con `SESSION_SECRET` como clave: mismo secreto ya validado por `config/env.ts`, sin añadir uno nuevo. */
export class HmacTokenHasher implements TokenHasher {
  constructor(private readonly secret: string) {}

  hash(secret: string): string {
    return createHmac('sha256', this.secret).update(secret).digest('hex');
  }
}
