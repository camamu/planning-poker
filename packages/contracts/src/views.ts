/** Mismo catálogo que `HAT_IDS` del dominio; `hatIds` en commands.ts lo valida en el borde. */
export type HatIdView =
  'cowboy' | 'wizard' | 'propeller' | 'crown' | 'top-hat' | 'party' | 'pirate' | 'viking' | 'chef';
export type ParticipantRoleView = 'VOTER' | 'SPECTATOR';
export type IssueStatusView = 'PENDING' | 'VOTING' | 'ESTIMATED';
export type RoundStatusView = 'OPEN' | 'REVEALED' | 'CLOSED';
export type WhoCanRevealView = 'FACILITATOR_ONLY' | 'ANYONE' | 'NAMED_LIST' | 'DEALER';

export interface ParticipantView {
  readonly id: string;
  readonly displayName: string;
  readonly role: ParticipantRoleView;
  readonly isFacilitator: boolean;
  /** Conectado ahora mismo. Dato efímero de presencia, no persistido (ADR 0015). */
  readonly online: boolean;
  /** Sombrero del avatar, `null` sin sombrero (ADR 0017). */
  readonly hat: HatIdView | null;
}

export interface IssueView {
  readonly id: string;
  readonly title: string;
  /** `null` = sin descripción (ausente o vacía en el dominio). */
  readonly description: string | null;
  /** Siempre http(s): se valida en el borde y se pinta como enlace. */
  readonly externalUrl: string | null;
  readonly status: IssueStatusView;
  readonly finalEstimate: string | null;
}

export interface RoundResultView {
  readonly distribution: Record<string, number>;
  readonly average: number | null;
  readonly agreementPercentage: number;
  readonly mostVoted: string | null;
  readonly isUnanimous: boolean;
}

/**
 * `hasVoted` es siempre `true`: quien no ha votado simplemente no aparece en `votes`.
 * `card` solo lleva valor si la ronda está revelada o si es el propio voto del viewer
 * (invariante 7 — ver `application/read-models/toGameView.ts`).
 */
export interface RoundVoteView {
  readonly participantId: string;
  readonly card: string | null;
  readonly hasVoted: true;
}

/**
 * Ronda ya revelada de la misma tarea que la actual. A diferencia de `RoundVoteView`, `card` va
 * siempre en claro: `toGameView` solo construye esto desde rondas reveladas (invariante 7).
 */
export interface PastRoundView {
  readonly id: string;
  readonly roundNumber: number;
  readonly votes: ReadonlyArray<{ readonly participantId: string; readonly card: string }>;
  readonly result: RoundResultView;
}

export interface RoundView {
  readonly id: string;
  readonly issueId: string;
  readonly roundNumber: number;
  readonly status: RoundStatusView;
  readonly votes: ReadonlyArray<RoundVoteView>;
  readonly result: RoundResultView | null;
  /** Rondas reveladas o cerradas de la misma tarea anteriores a esta, en orden (ADR 0020). */
  readonly previousRounds: ReadonlyArray<PastRoundView>;
  /** Participante elegido como "dealer" para la tarea de esta ronda; ver `Game.currentDealer()`. */
  readonly dealerId: string | null;
  /** ISO 8601. Fecha límite de la cuenta atrás (F5), o `null` si `countdownSeconds` está desactivado. */
  readonly timerDeadline: string | null;
}

/**
 * Una ronda en diferido que sigue viva para la sala: abierta, o revelada y pendiente de estimar
 * (ADR 0027). Invariante 7: mientras está abierta solo lleva quién ha votado y la carta del propio
 * viewer; `votes` y `result` llegan únicamente cuando la ronda está revelada.
 */
export interface AsyncRoundView {
  readonly roundId: string;
  readonly issueId: string;
  readonly status: RoundStatusView;
  /** Quién ha votado, sin la carta. */
  readonly voterIds: ReadonlyArray<string>;
  /** La carta del propio viewer, o `null` si no ha votado. Nunca la de otro. */
  readonly ownCard: string | null;
  /** Vacío mientras la ronda está abierta. */
  readonly votes: ReadonlyArray<{ readonly participantId: string; readonly card: string }>;
  readonly result: RoundResultView | null;
}

export interface GameSettingsView {
  readonly autoReveal: boolean;
  readonly whoCanReveal: WhoCanRevealView;
  readonly namedRevealers: ReadonlyArray<string>;
  readonly allowVoteChange: boolean;
  readonly celebrate: boolean;
  readonly throwEmojis: boolean;
  readonly countdownSeconds: number | null;
  readonly revealOnTimeout: boolean;
}

export interface GameView {
  readonly id: string;
  readonly name: string;
  readonly deck: { readonly cards: ReadonlyArray<string> };
  readonly settings: GameSettingsView;
  readonly participants: ReadonlyArray<ParticipantView>;
  readonly issues: ReadonlyArray<IssueView>;
  readonly currentRound: RoundView | null;
  /** Rondas en diferido vivas, en el orden en que se abrieron (ADR 0027). */
  readonly asyncRounds: ReadonlyArray<AsyncRoundView>;
}

/**
 * Una tarea en el resumen de la sesión. Solo agregados: el resumen se comparte fuera de la sala y
 * no lleva ningún voto individual (ADR 0025).
 */
export interface GameSummaryIssueView extends IssueView {
  /** Rondas reveladas de la tarea; una ronda abierta no cuenta. */
  readonly rounds: number;
  /** De la última ronda revelada. `null` si la tarea aún no tiene ninguna. */
  readonly agreementPercentage: number | null;
  readonly average: number | null;
  /** De abrir la primera ronda a la estimación final. `null` si falta cualquiera de los dos tiempos. */
  readonly durationMs: number | null;
}

export interface GameSummaryTotalsView {
  /** Tareas con estimación final. */
  readonly estimatedCount: number;
  /** Tareas sin estimación final: pendientes o en votación. */
  readonly pendingCount: number;
  /** Suma de las estimaciones numéricas. `null` si ninguna lo es (baraja de tallas). */
  readonly points: number | null;
  /** Recuento por valor de las estimaciones no numéricas; `?` y `☕` no cuentan. */
  readonly nonNumericEstimates: Record<string, number>;
  /** Tareas estimadas cuya última ronda revelada terminó en unanimidad. */
  readonly unanimousCount: number;
  /** Tareas que necesitaron más de una ronda revelada. */
  readonly multiRoundCount: number;
  /** Media de las duraciones conocidas. `null` si no hay ninguna. */
  readonly averageDurationMs: number | null;
  /** Participantes distintos que votaron en alguna ronda revelada. */
  readonly voterCount: number;
}

/** `GET /api/games/:id/summary` (ADR 0025). */
export interface GameSummaryView {
  readonly id: string;
  readonly name: string;
  readonly issues: ReadonlyArray<GameSummaryIssueView>;
  readonly totals: GameSummaryTotalsView;
}

export interface TeamView {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/** Una partida en el histórico del equipo (`GET /api/teams/:slug/games`, ADR 0024). */
export interface TeamGameView {
  readonly id: string;
  readonly name: string;
  /** ISO 8601. Es también el cursor `before` de la página siguiente. */
  readonly createdAt: string;
  readonly issueCount: number;
  readonly estimatedCount: number;
  readonly participantCount: number;
}

/** `teamId: null` = baraja de sistema (visible para todos, no editable). */
export interface DeckSummaryView {
  readonly id: string;
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
  readonly teamId: string | null;
}

/** `POST /api/admin/session` — el token va en `Authorization: Bearer` en el resto de `/api/admin/*`. */
export interface AdminSessionView {
  readonly token: string;
  readonly expiresAt: string;
}

export interface AdminGameView {
  readonly id: string;
  readonly name: string;
  readonly team: { readonly id: string; readonly name: string } | null;
  readonly participantCount: number;
  readonly issueCount: number;
  readonly estimatedIssueCount: number;
  readonly createdAt: string;
}

export interface AdminTeamView {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly deckCount: number;
  readonly gameCount: number;
}

export interface AdminDeckView {
  readonly id: string;
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
  readonly team: { readonly id: string; readonly name: string } | null;
}

/** `POST /api/admin/teams/:teamId/token` — el token nuevo en claro, una única vez. */
export interface AdminTeamTokenView {
  readonly slug: string;
  readonly token: string;
}
