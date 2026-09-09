import { DomainError } from '../shared/DomainError.js';

export class InvalidIdError extends DomainError {
  constructor(kind: string, value: string) {
    super(`"${value}" no es un ${kind} válido: no puede estar vacío.`);
  }
}

function requireNonEmpty(kind: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvalidIdError(kind, value);
  return trimmed;
}

export class GameId {
  private constructor(readonly value: string) {}

  static of(value: string): GameId {
    return new GameId(requireNonEmpty('GameId', value));
  }

  equals(other: GameId): boolean {
    return this.value === other.value;
  }
}

export class ParticipantId {
  private constructor(readonly value: string) {}

  static of(value: string): ParticipantId {
    return new ParticipantId(requireNonEmpty('ParticipantId', value));
  }

  equals(other: ParticipantId): boolean {
    return this.value === other.value;
  }
}

export class IssueId {
  private constructor(readonly value: string) {}

  static of(value: string): IssueId {
    return new IssueId(requireNonEmpty('IssueId', value));
  }

  equals(other: IssueId): boolean {
    return this.value === other.value;
  }
}

export class RoundId {
  private constructor(readonly value: string) {}

  static of(value: string): RoundId {
    return new RoundId(requireNonEmpty('RoundId', value));
  }

  equals(other: RoundId): boolean {
    return this.value === other.value;
  }
}
