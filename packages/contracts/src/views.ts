export type ParticipantRoleView = 'VOTER' | 'SPECTATOR';
export type IssueStatusView = 'PENDING' | 'VOTING' | 'ESTIMATED';
export type RoundStatusView = 'OPEN' | 'REVEALED' | 'CLOSED';
export type WhoCanRevealView = 'FACILITATOR_ONLY' | 'ANYONE' | 'NAMED_LIST' | 'DEALER';

export interface ParticipantView {
  readonly id: string;
  readonly displayName: string;
  readonly role: ParticipantRoleView;
  readonly isFacilitator: boolean;
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

export interface RoundView {
  readonly id: string;
  readonly issueId: string;
  readonly roundNumber: number;
  readonly status: RoundStatusView;
  readonly votes: ReadonlyArray<RoundVoteView>;
  readonly result: RoundResultView | null;
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
