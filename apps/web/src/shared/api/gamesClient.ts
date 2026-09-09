import type {
  AddIssueCommandInput,
  CreateGameCommandInput,
  GameView,
  JoinGameCommandInput,
  UpdateGameSettingsCommandInput,
} from '@pp/contracts';

export interface CreateGameResult {
  readonly gameId: string;
  readonly facilitatorId: string;
}

export interface JoinGameResult {
  readonly participantId: string;
}

export interface AddIssueResult {
  readonly issueId: string;
}

export interface GameStateResult {
  readonly version: number;
  readonly state: GameView;
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

export function createGame(input: CreateGameCommandInput): Promise<CreateGameResult> {
  return requestJson('/api/games', { method: 'POST', body: JSON.stringify(input) });
}

export function joinGame(gameId: string, input: JoinGameCommandInput): Promise<JoinGameResult> {
  return requestJson(`/api/games/${gameId}/participants`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function addIssue(gameId: string, input: AddIssueCommandInput): Promise<AddIssueResult> {
  return requestJson(`/api/games/${gameId}/issues`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getGameState(gameId: string, participantId: string): Promise<GameStateResult> {
  const query = new URLSearchParams({ participantId }).toString();
  return requestJson(`/api/games/${gameId}?${query}`);
}

export function updateGameSettings(
  gameId: string,
  input: UpdateGameSettingsCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
