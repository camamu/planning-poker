import { Team } from '../../domain/team/Team.js';
import { TeamId } from '../../domain/team/TeamId.js';
import { TeamName } from '../../domain/team/TeamName.js';
import { TeamSlug } from '../../domain/team/TeamSlug.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import type { TokenHasher } from '../ports/TokenHasher.js';

export interface CreateTeamCommand {
  readonly name: string;
}

export interface CreateTeamResult {
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
  /** En claro, una única vez: el único momento en que el servidor lo tiene disponible. */
  readonly token: string;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CreateTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly hasher: TokenHasher,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateTeamCommand): Promise<CreateTeamResult> {
    const name = TeamName.of(command.name);
    const base = slugify(name.value) || 'equipo';
    // Sufijo corto siempre, para no depender de reintentar contra la unicidad de la BD.
    const slug = TeamSlug.of(`${base}-${this.ids.generate().slice(0, 6)}`);

    const token = this.ids.generate();
    const team = Team.create({
      id: TeamId.of(this.ids.generate()),
      slug,
      name,
      tokenHash: this.hasher.hash(token),
    });

    await this.teams.save(team);

    return { teamId: team.id.value, slug: slug.value, name: name.value, token };
  }
}
