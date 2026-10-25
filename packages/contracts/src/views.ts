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
}

export interface TeamView {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

/** `teamId: null` = baraja de sistema (visible para todos, no editable). */
export interface DeckSummaryView {
  readonly id: string;
  readonly name: string;
  readonly cards: ReadonlyArray<string>;
  readonly teamId: string | null;
}
