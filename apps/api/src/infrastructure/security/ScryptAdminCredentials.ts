import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { AdminCredentials } from '../../application/ports/AdminCredentials.js';

function scryptAsync(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}
const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

/**
 * Formato `scrypt:<salt>:<hash>` (base64url): sin `$`, que docker compose interpretaría como
 * interpolación de variables al leer `ADMIN_PASSWORD_HASH` de un `.env`.
 */
export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return [PREFIX, salt.toString('base64url'), derived.toString('base64url')].join(':');
}

export function isAdminPasswordHash(value: string): boolean {
  const [prefix, salt, hash] = value.split(':');
  return prefix === PREFIX && Boolean(salt) && Boolean(hash);
}

function equalInConstantTime(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export class ScryptAdminCredentials implements AdminCredentials {
  private readonly salt: Buffer;
  private readonly expectedHash: Buffer;

  constructor(
    private readonly username: string,
    passwordHash: string,
  ) {
    const [, salt = '', hash = ''] = passwordHash.split(':');
    this.salt = Buffer.from(salt, 'base64url');
    this.expectedHash = Buffer.from(hash, 'base64url');
  }

  async matches(username: string, password: string): Promise<boolean> {
    // La contraseña se deriva siempre, aunque el usuario no coincida: si no, el tiempo de respuesta
    // delataría cuándo se ha acertado el usuario.
    const derived = await scryptAsync(password, this.salt, KEY_LENGTH);
    const usernameMatches = equalInConstantTime(
      Buffer.from(username, 'utf8'),
      Buffer.from(this.username, 'utf8'),
    );
    return equalInConstantTime(derived, this.expectedHash) && usernameMatches;
  }
}
