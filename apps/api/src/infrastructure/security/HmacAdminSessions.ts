import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AdminSession, AdminSessions } from '../../application/ports/AdminSessions.js';

/**
 * Token sin estado `<expiraMs>.<firma>`: con una sola instancia y un solo administrador no hace
 * falta tabla de sesiones. La clave mezcla `SESSION_SECRET` con el hash de la contraseña, así que
 * cambiar la contraseña invalida todas las sesiones abiertas sin más mecanismo.
 */
export class HmacAdminSessions implements AdminSessions {
  constructor(
    private readonly key: string,
    private readonly ttlMs: number,
  ) {}

  issue(now: Date): AdminSession {
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const expiry = expiresAt.getTime().toString();
    return { token: `${expiry}.${this.sign(expiry)}`, expiresAt };
  }

  isValid(token: string, now: Date): boolean {
    const [expiry, signature, ...rest] = token.split('.');
    if (!expiry || !signature || rest.length > 0) return false;
    const expected = Buffer.from(this.sign(expiry), 'utf8');
    const received = Buffer.from(signature, 'utf8');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
    return Number(expiry) > now.getTime();
  }

  private sign(expiry: string): string {
    return createHmac('sha256', this.key).update(`admin-session:${expiry}`).digest('base64url');
  }
}
