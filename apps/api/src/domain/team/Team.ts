import type { TeamId } from './TeamId.js';
import type { TeamName } from './TeamName.js';
import type { TeamSlug } from './TeamSlug.js';

export interface TeamProps {
  readonly id: TeamId;
  readonly slug: TeamSlug;
  readonly name: TeamName;
  /** Hash del token de acceso (calculado por `TokenHasher`, puerto de `application/`) — el dominio nunca ve el secreto en claro. */
  readonly tokenHash: string;
}

/**
 * Sin registro ni cuentas (docs/02-decisiones-y-plan.md §2): un `Team` es solo el ámbito al que
 * cuelgan las barajas personalizadas, identificado por `slug` en la URL y protegido por un token
 * de un solo reparto (se muestra una vez al crearlo, igual que el link de facilitador de `Game`).
 */
export class Team {
  private constructor(
    readonly id: TeamId,
    readonly slug: TeamSlug,
    readonly name: TeamName,
    readonly tokenHash: string,
  ) {}

  static create(props: TeamProps): Team {
    return new Team(props.id, props.slug, props.name, props.tokenHash);
  }

  static reconstitute(props: TeamProps): Team {
    return new Team(props.id, props.slug, props.name, props.tokenHash);
  }

  hasTokenHash(candidateHash: string): boolean {
    return this.tokenHash === candidateHash;
  }
}
