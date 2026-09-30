import type {
  AdminDeckView,
  AdminGameView,
  AdminLoginCommandInput,
  AdminSessionView,
  AdminTeamTokenView,
  AdminTeamView,
  RenameTeamCommandInput,
} from '@pp/contracts';

/** La sesión ha caducado o no es válida: quien llame debe volver a pedir credenciales. */
export class AdminUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminUnauthorizedError';
  }
}

async function requestJson<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Error ${response.status.toString()} al llamar a ${path}`;
    // En el login un 401 son credenciales incorrectas, no una sesión caducada.
    if (response.status === 401 && token !== null) throw new AdminUnauthorizedError(message);
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function logInAdmin(input: AdminLoginCommandInput): Promise<AdminSessionView> {
  return requestJson('/api/admin/session', null, { method: 'POST', body: JSON.stringify(input) });
}

export function listAdminGames(token: string): Promise<ReadonlyArray<AdminGameView>> {
  return requestJson('/api/admin/games', token);
}

export function deleteAdminGame(token: string, gameId: string): Promise<void> {
  return requestJson(`/api/admin/games/${gameId}`, token, { method: 'DELETE' });
}

export function listAdminTeams(token: string): Promise<ReadonlyArray<AdminTeamView>> {
  return requestJson('/api/admin/teams', token);
}

export function renameAdminTeam(
  token: string,
  teamId: string,
  input: RenameTeamCommandInput,
): Promise<void> {
  return requestJson(`/api/admin/teams/${teamId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function regenerateAdminTeamToken(
  token: string,
  teamId: string,
): Promise<AdminTeamTokenView> {
  return requestJson(`/api/admin/teams/${teamId}/token`, token, { method: 'POST' });
}

export function deleteAdminTeam(token: string, teamId: string): Promise<void> {
  return requestJson(`/api/admin/teams/${teamId}`, token, { method: 'DELETE' });
}

export function listAdminDecks(token: string): Promise<ReadonlyArray<AdminDeckView>> {
  return requestJson('/api/admin/decks', token);
}

export function deleteAdminDeck(token: string, deckId: string): Promise<void> {
  return requestJson(`/api/admin/decks/${deckId}`, token, { method: 'DELETE' });
}
