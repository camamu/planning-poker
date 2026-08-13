import { DomainError } from '../shared/DomainError.js';

export class InvalidDeckNameError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un nombre de baraja válido: no puede estar vacío.`);
  }
}

export class DeckName {
  private constructor(readonly value: string) {}

  static of(raw: string): DeckName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidDeckNameError(raw);
    return new DeckName(trimmed);
  }
}
