import type {
  AddIssueCommandInput,
  ChangeGameDeckCommandInput,
  ChangeParticipantHatCommandInput,
  ClaimFacilitatorCommandInput,
  CreateGameCommandInput,
  DeckSummaryView,
  EditIssueCommandInput,
  GameSummaryView,
  GameView,
  ImportIssuesCommandInput,
  JoinGameCommandInput,
  RemoveIssueCommandInput,
  ReorderIssuesCommandInput,
  TransferFacilitatorCommandInput,
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

export interface ImportIssuesResult {
  readonly issueIds: ReadonlyArray<string>;
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

export function importIssues(
  gameId: string,
  input: ImportIssuesCommandInput,
): Promise<ImportIssuesResult> {
  return requestJson(`/api/games/${gameId}/issues/batch`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function editIssue(
  gameId: string,
  issueId: string,
  input: EditIssueCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function removeIssue(
  gameId: string,
  issueId: string,
  input: RemoveIssueCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/issues/${issueId}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  });
}

export function reorderIssues(gameId: string, input: ReorderIssuesCommandInput): Promise<void> {
  return requestJson(`/api/games/${gameId}/issues/order`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getGameState(gameId: string, participantId: string): Promise<GameStateResult> {
  const query = new URLSearchParams({ participantId }).toString();
  return requestJson(`/api/games/${gameId}?${query}`);
}

export function getGameSummary(gameId: string): Promise<GameSummaryView> {
  return requestJson(`/api/games/${gameId}/summary`);
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

export function listGameDecks(gameId: string): Promise<ReadonlyArray<DeckSummaryView>> {
  return requestJson(`/api/games/${gameId}/decks`);
}

export function changeGameDeck(gameId: string, input: ChangeGameDeckCommandInput): Promise<void> {
  return requestJson(`/api/games/${gameId}/deck`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function changeParticipantHat(
  gameId: string,
  participantId: string,
  input: ChangeParticipantHatCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/participants/${participantId}/hat`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** `requestedBy` es quien lo pide: el propio participante (salir) o el facilitador (quitar). */
export function removeParticipant(
  gameId: string,
  participantId: string,
  requestedBy: string,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/participants/${participantId}`, {
    method: 'DELETE',
    body: JSON.stringify({ participantId: requestedBy }),
  });
}

export function transferFacilitator(
  gameId: string,
  input: TransferFacilitatorCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/facilitator`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function claimFacilitator(
  gameId: string,
  input: ClaimFacilitatorCommandInput,
): Promise<void> {
  return requestJson(`/api/games/${gameId}/facilitator/claim`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
