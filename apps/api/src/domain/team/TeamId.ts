import { DomainError } from '../shared/DomainError.js';

export class InvalidTeamIdError extends DomainError {
  constructor(value: string) {
    super(`"${value}" no es un TeamId válido: no puede estar vacío.`);
  }
}

export class TeamId {
  private constructor(readonly value: string) {}

  static of(value: string): TeamId {
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new InvalidTeamIdError(value);
    return new TeamId(trimmed);
  }

  equals(other: TeamId): boolean {
    return this.value === other.value;
  }
}
