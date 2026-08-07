import type { CardValue } from '../deck/CardValue.js';
import { DomainError } from '../shared/DomainError.js';
import type { IssueId, ParticipantId, RoundId } from './ids.js';
import { RoundResult } from './RoundResult.js';

export type RoundStatus = 'OPEN' | 'REVEALED' | 'CLOSED';

export class RoundNotOpenError extends DomainError {
  constructor(readonly roundId: RoundId) {
    super(`La ronda ${roundId.value} no está abierta.`);
  }
}

export class RoundNotRevealedError extends DomainError {
  constructor(readonly roundId: RoundId) {
    super(`La ronda ${roundId.value} todavía no se ha revelado.`);
  }
}

interface CastEntry {
  readonly participantId: ParticipantId;
  readonly card: CardValue;
}

export class Round {
  private readonly votes = new Map<string, CastEntry>();
  private status: RoundStatus = 'OPEN';
  private revealedAt: Date | null = null;
  private result: RoundResult | null = null;

  private constructor(
    readonly id: RoundId,
    readonly issueId: IssueId,
    readonly roundNumber: number,
  ) {}

  static open(id: RoundId, issueId: IssueId, roundNumber: number): Round {
    return new Round(id, issueId, roundNumber);
  }

  isOpen(): boolean {
    return this.status === 'OPEN';
  }

  isRevealed(): boolean {
    return this.status === 'REVEALED' || this.status === 'CLOSED';
  }

  currentStatus(): RoundStatus {
    return this.status;
  }

  currentRevealedAt(): Date | null {
    return this.revealedAt;
  }

  hasVoted(participantId: ParticipantId): boolean {
    return this.votes.has(participantId.value);
  }

  hasSameVote(participantId: ParticipantId, card: CardValue): boolean {
    return this.votes.get(participantId.value)?.card.equals(card) ?? false;
  }

  castVote(participantId: ParticipantId, card: CardValue): void {
    if (!this.isOpen()) throw new RoundNotOpenError(this.id);
    this.votes.set(participantId.value, { participantId, card });
  }

  retractVote(participantId: ParticipantId): void {
    if (!this.isOpen()) throw new RoundNotOpenError(this.id);
    this.votes.delete(participantId.value);
  }

  everyVoterHasVoted(voters: ReadonlyArray<ParticipantId>): boolean {
    return voters.every((voter) => this.hasVoted(voter));
  }

  reveal(now: Date): void {
    if (!this.isOpen()) throw new RoundNotOpenError(this.id);
    this.result = RoundResult.from([...this.votes.values()].map((entry) => entry.card));
    this.status = 'REVEALED';
    this.revealedAt = now;
  }

  close(): void {
    if (this.status !== 'REVEALED') throw new RoundNotRevealedError(this.id);
    this.status = 'CLOSED';
  }

  /** Invariante 7: el valor de un voto ajeno solo es legible una vez revelada la ronda. */
  revealedVotes(): ReadonlyArray<CastEntry> {
    if (!this.isRevealed()) throw new RoundNotRevealedError(this.id);
    return [...this.votes.values()];
  }

  revealedResult(): RoundResult {
    if (this.result === null) throw new RoundNotRevealedError(this.id);
    return this.result;
  }
}
