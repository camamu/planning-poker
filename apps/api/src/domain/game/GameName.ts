import { DomainError } from '../shared/DomainError.js';

export class InvalidGameNameError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un nombre de partida válido: no puede estar vacío.`);
  }
}

export class GameName {
  private constructor(readonly value: string) {}

  static of(raw: string): GameName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidGameNameError(raw);
    return new GameName(trimmed);
  }
}
