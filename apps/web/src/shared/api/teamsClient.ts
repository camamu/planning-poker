import type {
  CreateTeamCommandInput,
  DeckSummaryView,
  SaveCustomDeckCommandInput,
  TeamView,
} from '@pp/contracts';

export interface CreateTeamResult {
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
  readonly token: string;
}

export interface SaveCustomDeckResult {
  readonly deckId: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Error ${response.status.toString()} al llamar a ${path}`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createTeam(input: CreateTeamCommandInput): Promise<CreateTeamResult> {
  return requestJson('/api/teams', { method: 'POST', body: JSON.stringify(input) });
}

export function authenticateTeam(slug: string, token: string): Promise<TeamView> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${slug}?${query}`);
}

export function listDecks(teamSlug?: string): Promise<ReadonlyArray<DeckSummaryView>> {
  const query = teamSlug ? `?${new URLSearchParams({ teamSlug }).toString()}` : '';
  return requestJson(`/api/decks${query}`);
}

export function saveCustomDeck(
  teamSlug: string,
  token: string,
  input: SaveCustomDeckCommandInput,
): Promise<SaveCustomDeckResult> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${teamSlug}/decks?${query}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCustomDeck(
  teamSlug: string,
  token: string,
  deckId: string,
  input: SaveCustomDeckCommandInput,
): Promise<void> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${teamSlug}/decks/${deckId}?${query}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCustomDeck(teamSlug: string, token: string, deckId: string): Promise<void> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${teamSlug}/decks/${deckId}?${query}`, { method: 'DELETE' });
}
