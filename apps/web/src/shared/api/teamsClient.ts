import type {
  AddWebhookCommandInput,
  CreateTeamCommandInput,
  CreatedWebhookView,
  DeckSummaryView,
  SaveCustomDeckCommandInput,
  TeamGameView,
  TeamView,
  WebhookTestResultView,
  WebhookView,
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
    // Sin cuerpo no se manda: Fastify responde 400 a un `application/json` vacío, y eso rompía los
    // `DELETE` y las acciones sin datos (borrar una baraja, enviar una prueba de webhook).
    headers: init?.body === undefined ? {} : { 'content-type': 'application/json' },
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

export interface TeamGamesPage {
  readonly limit: number;
  /** El `createdAt` de la última partida de la página anterior. */
  readonly before?: string | undefined;
}

export function listTeamGames(
  slug: string,
  token: string,
  page: TeamGamesPage,
): Promise<ReadonlyArray<TeamGameView>> {
  const query = new URLSearchParams({ k: token, limit: page.limit.toString() });
  if (page.before !== undefined) query.set('before', page.before);
  return requestJson(`/api/teams/${slug}/games?${query.toString()}`);
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

export function listWebhooks(slug: string, token: string): Promise<ReadonlyArray<WebhookView>> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${slug}/webhooks?${query}`);
}

/** La única respuesta que lleva el secreto completo: hay que enseñarlo ahora (ADR 0028). */
export function addWebhook(
  slug: string,
  token: string,
  input: AddWebhookCommandInput,
): Promise<CreatedWebhookView> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${slug}/webhooks?${query}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function removeWebhook(slug: string, token: string, webhookId: string): Promise<void> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${slug}/webhooks/${webhookId}?${query}`, { method: 'DELETE' });
}

/** Un `ping` con una sola entrega; el resultado dice si el receptor contestó y con qué código. */
export function testWebhook(
  slug: string,
  token: string,
  webhookId: string,
): Promise<WebhookTestResultView> {
  const query = new URLSearchParams({ k: token }).toString();
  return requestJson(`/api/teams/${slug}/webhooks/${webhookId}/test?${query}`, { method: 'POST' });
}
