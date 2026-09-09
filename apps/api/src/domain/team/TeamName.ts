import { DomainError } from '../shared/DomainError.js';

export class InvalidTeamNameError extends DomainError {
  constructor(raw: string) {
    super(`"${raw}" no es un nombre de equipo válido: no puede estar vacío.`);
  }
}

export class TeamName {
  private constructor(readonly value: string) {}

  static of(raw: string): TeamName {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidTeamNameError(raw);
    return new TeamName(trimmed);
  }
}
