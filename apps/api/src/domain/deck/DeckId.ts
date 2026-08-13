import { DomainError } from '../shared/DomainError.js';

export class InvalidDeckIdError extends DomainError {
  constructor(value: string) {
    super(`"${value}" no es un DeckId válido: no puede estar vacío.`);
  }
}

export class DeckId {
  private constructor(readonly value: string) {}

  static of(value: string): DeckId {
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new InvalidDeckIdError(value);
    return new DeckId(trimmed);
  }

  equals(other: DeckId): boolean {
    return this.value === other.value;
  }
}
