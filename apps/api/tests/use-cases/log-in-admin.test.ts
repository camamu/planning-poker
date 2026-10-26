import { describe, expect, it } from 'vitest';
import type { AdminCredentials } from '../../src/application/ports/AdminCredentials.js';
import type { AdminSession, AdminSessions } from '../../src/application/ports/AdminSessions.js';
import { InvalidAdminCredentialsError } from '../../src/application/use-cases/InvalidAdminCredentialsError.js';
import { LogInAdmin } from '../../src/application/use-cases/LogInAdmin.js';
import { FixedClock } from './support/FixedClock.js';
import { NOW } from './support/context.js';

const credentials: AdminCredentials = {
  matches: (username, password) => Promise.resolve(username === 'admin' && password === 'secreta'),
};

class RecordingSessions implements AdminSessions {
  readonly issuedAt: Date[] = [];

  issue(now: Date): AdminSession {
    this.issuedAt.push(now);
    return { token: 'token-de-sesion', expiresAt: new Date(now.getTime() + 1000) };
  }

  isValid(): boolean {
    return true;
  }
}

describe('LogInAdmin', () => {
  it('abre una sesión cuando usuario y contraseña coinciden', async () => {
    const sessions = new RecordingSessions();

    const session = await new LogInAdmin(credentials, sessions, new FixedClock(NOW)).execute({
      username: 'admin',
      password: 'secreta',
    });

    expect(session).toEqual({
      token: 'token-de-sesion',
      expiresAt: new Date(NOW.getTime() + 1000).toISOString(),
    });
    expect(sessions.issuedAt).toEqual([NOW]);
  });

  it('no abre sesión con credenciales incorrectas', async () => {
    const sessions = new RecordingSessions();

    await expect(
      new LogInAdmin(credentials, sessions, new FixedClock(NOW)).execute({
        username: 'admin',
        password: 'otra',
      }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
    expect(sessions.issuedAt).toEqual([]);
  });
});
