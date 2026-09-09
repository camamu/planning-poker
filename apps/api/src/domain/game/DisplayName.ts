import { DomainError } from '../shared/DomainError.js';

export class InvalidDisplayNameError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un nombre de participante válido: no puede estar vacío.`);
  }
}

export class DisplayName {
  private constructor(readonly value: string) {}

  static of(raw: string): DisplayName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidDisplayNameError(raw);
    return new DisplayName(trimmed);
  }
}
