import type { AdminTeamTokenView } from '@pp/contracts';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';
import { loadTeam } from './loadTeam.js';

export interface RegenerateTeamTokenCommand {
  readonly teamId: string;
}

/** Recupera un enlace de equipo perdido: mismo reparto único que `CreateTeam`, el token no se persiste en claro. */
export class RegenerateTeamToken {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegenerateTeamTokenCommand): Promise<AdminTeamTokenView> {
    const team = await loadTeam(this.teams, command.teamId);
    const token = this.ids.generate();
    await this.teams.save(team.rotateToken(this.hasher.hash(token)));
    return { slug: team.slug.value, token };
  }
}
