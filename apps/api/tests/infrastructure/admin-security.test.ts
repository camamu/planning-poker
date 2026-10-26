import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/infrastructure/config/env.js';
import { LoginThrottle } from '../../src/infrastructure/http/LoginThrottle.js';
import { HmacAdminSessions } from '../../src/infrastructure/security/HmacAdminSessions.js';
import {
  ScryptAdminCredentials,
  hashAdminPassword,
} from '../../src/infrastructure/security/ScryptAdminCredentials.js';

const NOW = new Date('2026-08-07T10:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('ScryptAdminCredentials', () => {
  it('acepta el usuario y la contraseña con los que se generó el hash', async () => {
    const credentials = new ScryptAdminCredentials('admin', await hashAdminPassword('secreta'));

    await expect(credentials.matches('admin', 'secreta')).resolves.toBe(true);
  });

  it('rechaza una contraseña o un usuario distintos', async () => {
    const credentials = new ScryptAdminCredentials('admin', await hashAdminPassword('secreta'));

    await expect(credentials.matches('admin', 'otra')).resolves.toBe(false);
    await expect(credentials.matches('root', 'secreta')).resolves.toBe(false);
  });

  it('genera un hash distinto cada vez para la misma contraseña (sal aleatoria)', async () => {
    expect(await hashAdminPassword('secreta')).not.toBe(await hashAdminPassword('secreta'));
  });
});

describe('HmacAdminSessions', () => {
  it('valida el token que emite mientras no caduca', () => {
    const sessions = new HmacAdminSessions('clave', HOUR);
    const { token, expiresAt } = sessions.issue(NOW);

    expect(expiresAt).toEqual(new Date(NOW.getTime() + HOUR));
    expect(sessions.isValid(token, new Date(NOW.getTime() + HOUR - 1))).toBe(true);
    expect(sessions.isValid(token, expiresAt)).toBe(false);
  });

  it('rechaza un token con la caducidad alterada o firmado con otra clave', () => {
    const { token } = new HmacAdminSessions('clave', HOUR).issue(NOW);
    const [, signature] = token.split('.');
    const extended = `${(NOW.getTime() + 100 * HOUR).toString()}.${signature ?? ''}`;

    expect(new HmacAdminSessions('clave', HOUR).isValid(extended, NOW)).toBe(false);
    expect(new HmacAdminSessions('otra-clave', HOUR).isValid(token, NOW)).toBe(false);
    expect(new HmacAdminSessions('clave', HOUR).isValid('basura', NOW)).toBe(false);
  });
});

describe('LoginThrottle', () => {
  it('bloquea una IP tras N fallos dentro de la ventana y la libera al caducar', () => {
    const throttle = new LoginThrottle(2, 1000);
    throttle.recordFailure('1.2.3.4', 0);
    expect(throttle.isBlocked('1.2.3.4', 10)).toBe(false);
    throttle.recordFailure('1.2.3.4', 20);

    expect(throttle.isBlocked('1.2.3.4', 30)).toBe(true);
    expect(throttle.isBlocked('5.6.7.8', 30)).toBe(false);
    expect(throttle.isBlocked('1.2.3.4', 1000)).toBe(false);
  });

  it('un login correcto limpia los fallos acumulados', () => {
    const throttle = new LoginThrottle(1, 1000);
    throttle.recordFailure('1.2.3.4', 0);
    throttle.reset('1.2.3.4');

    expect(throttle.isBlocked('1.2.3.4', 10)).toBe(false);
  });
});

describe('loadEnv — panel de gestión', () => {
  const base = {
    DATABASE_URL: 'postgres://localhost/db',
    CORS_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 'secreto',
  };

  it('deja el panel desactivado si no hay credenciales de administración', () => {
    const env = loadEnv(base);
    expect(env.ADMIN_USERNAME).toBeUndefined();
    expect(env.ADMIN_PASSWORD_HASH).toBeUndefined();
  });

  it('exige ADMIN_USERNAME y ADMIN_PASSWORD_HASH juntos', () => {
    expect(() => loadEnv({ ...base, ADMIN_USERNAME: 'admin' })).toThrow(/van juntos/);
  });

  it('rechaza un ADMIN_PASSWORD_HASH que no sale del script (p. ej. la contraseña en claro)', () => {
    expect(() =>
      loadEnv({ ...base, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: 'contraseña' }),
    ).toThrow(/admin:hash-password/);
  });

  it('acepta un hash generado por hashAdminPassword', async () => {
    const env = loadEnv({
      ...base,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: await hashAdminPassword('secreta'),
    });
    expect(env.ADMIN_USERNAME).toBe('admin');
  });
});
