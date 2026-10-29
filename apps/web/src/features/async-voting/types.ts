import type { AsyncRoundView, ParticipantView } from '@pp/contracts';

/**
 * Todo lo que el panel de tareas necesita para la votación en diferido (ADR 0027). Va en un solo
 * objeto para que `IssueListPanel` no crezca una prop por cada dato o acción.
 */
export interface AsyncVotingProps {
  readonly rounds: ReadonlyArray<AsyncRoundView>;
  readonly viewerId: string;
  /** Los espectadores ven el avance pero no votan. */
  readonly viewerCanVote: boolean;
  readonly participants: ReadonlyArray<Pick<ParticipantView, 'id' | 'displayName' | 'role'>>;
  readonly deckCards: ReadonlyArray<string>;
  readonly canChangeVote: boolean;
  /** Quien puede revelar y cerrar estimaciones en lote; ver `canParticipantRevealAsync`. */
  readonly canReveal: boolean;
  /** Voto propio ya pintado y todavía sin confirmar por el servidor, por tarea. */
  readonly pendingCards: Readonly<Record<string, string>>;
  readonly onOpen: (issueIds: ReadonlyArray<string>) => void;
  readonly onVote: (issueId: string, card: string) => void;
  /** Sin `issueIds`, todas las rondas abiertas que tengan votos. */
  readonly onReveal: (issueIds?: ReadonlyArray<string>) => void;
  readonly onAcceptEstimate: (issueId: string, card: string) => void;
}
