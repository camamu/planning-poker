import { beforeEach, describe, expect, it } from 'vitest';
import { clearAdminSession, loadAdminSession, saveAdminSession } from './adminSession.js';

const NOW = new Date('2026-08-07T10:00:00Z');

describe('adminSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('recupera la sesión guardada mientras no caduca', () => {
    const session = { token: 'abc', expiresAt: '2026-08-07T18:00:00.000Z' };
    saveAdminSession(session);

    expect(loadAdminSession(NOW)).toEqual(session);
  });

  it('descarta una sesión caducada', () => {
    saveAdminSession({ token: 'abc', expiresAt: '2026-08-07T09:00:00.000Z' });

    expect(loadAdminSession(NOW)).toBeNull();
  });

  it('descarta lo que no tenga forma de sesión', () => {
    sessionStorage.setItem('pp:admin-session', '{"token":1}');

    expect(loadAdminSession(NOW)).toBeNull();
  });

  it('clearAdminSession la olvida', () => {
    saveAdminSession({ token: 'abc', expiresAt: '2026-08-07T18:00:00.000Z' });
    clearAdminSession();

    expect(loadAdminSession(NOW)).toBeNull();
  });
});
