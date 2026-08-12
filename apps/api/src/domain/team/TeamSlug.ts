import { DomainError } from '../shared/DomainError.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class InvalidTeamSlugError extends DomainError {
  constructor(raw: string) {
    super(
      `"${raw}" no es un slug de equipo válido: solo minúsculas, dígitos y guiones, sin guiones al principio o al final.`,
    );
  }
}

/** Identifica al equipo en la URL (`/t/<slug>`). Se genera a partir del nombre, no lo elige el usuario a mano. */
export class TeamSlug {
  private constructor(readonly value: string) {}

  static of(raw: string): TeamSlug {
    const trimmed = raw.trim().toLowerCase();
    if (!SLUG_PATTERN.test(trimmed)) throw new InvalidTeamSlugError(raw);
    return new TeamSlug(trimmed);
  }

  equals(other: TeamSlug): boolean {
    return this.value === other.value;
  }
}
