import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { resolveTeam } from './resolveTeam.js';

export interface AuthenticateTeamCommand {
  readonly slug: string;
  readonly token: string;
}

export interface AuthenticateTeamResult {
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
}

/** `GET /api/teams/:slug` — confirma que el link (`slug` + `k`) es válido antes de mostrar el equipo. */
export class AuthenticateTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
  ) {}

  async execute(command: AuthenticateTeamCommand): Promise<AuthenticateTeamResult> {
    const team = await resolveTeam(this.teams, this.hasher, command.slug, command.token);
    return { teamId: team.id.value, slug: team.slug.value, name: team.name.value };
  }
}
