import type { CardValue } from '../deck/CardValue.js';
import { DomainError } from '../shared/DomainError.js';
import type { IssueId } from './ids.js';

export type IssueStatus = 'PENDING' | 'VOTING' | 'ESTIMATED';

export class InvalidIssueTitleError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un título de issue válido: no puede estar vacío.`);
  }
}

export class Issue {
  private status: IssueStatus = 'PENDING';
  private finalEstimate: CardValue | null = null;

  private constructor(
    readonly id: IssueId,
    readonly title: string,
    readonly description: string | undefined,
    readonly externalUrl: string | undefined,
  ) {}

  static create(id: IssueId, title: string, description?: string, externalUrl?: string): Issue {
    const trimmed = title.trim();
    if (trimmed.length === 0) throw new InvalidIssueTitleError(title);
    return new Issue(id, trimmed, description, externalUrl);
  }

  currentStatus(): IssueStatus {
    return this.status;
  }

  currentFinalEstimate(): CardValue | null {
    return this.finalEstimate;
  }

  startVoting(): void {
    this.status = 'VOTING';
  }

  estimate(card: CardValue): void {
    this.finalEstimate = card;
    this.status = 'ESTIMATED';
  }
}
