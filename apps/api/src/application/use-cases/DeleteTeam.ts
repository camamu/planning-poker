import type { DeckRepository } from '../ports/DeckRepository.js';
import type { TeamRepository } from '../ports/TeamRepository.js';
import { loadTeam } from './loadTeam.js';

export interface DeleteTeamCommand {
  readonly teamId: string;
}

/**
 * Las partidas del equipo sobreviven (quedan sin equipo, `on delete set null`); sus barajas no.
 * Postgres ya borra las barajas por la FK en cascada, pero el borrado explícito mantiene el mismo
 * resultado en cualquier adaptador sin depender de que el almacén tenga claves foráneas.
 */
export class DeleteTeam {
  constructor(
    private readonly teams: TeamRepository,
    private readonly decks: DeckRepository,
  ) {}

  async execute(command: DeleteTeamCommand): Promise<void> {
    const team = await loadTeam(this.teams, command.teamId);
    await this.decks.deleteOwnedBy(team.id);
    await this.teams.delete(team.id);
  }
}
