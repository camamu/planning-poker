import { describe, expect, it } from 'vitest';
import type { TeamRepository } from '../../../src/application/ports/TeamRepository.js';
import { Team } from '../../../src/domain/team/Team.js';
import { TeamId } from '../../../src/domain/team/TeamId.js';
import { TeamName } from '../../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../../src/domain/team/TeamSlug.js';

function newTeam(id: string, slug: string, name = 'Backend Team'): Team {
  return Team.create({
    id: TeamId.of(id),
    slug: TeamSlug.of(slug),
    name: TeamName.of(name),
    tokenHash: 'hash-1',
  });
}

/** Suite compartida: se ejecuta contra InMemoryTeamRepository y PostgresTeamRepository. */
export function defineTeamRepositoryContractTests(
  makeRepository: () => TeamRepository | Promise<TeamRepository>,
): void {
  describe('TeamRepository', () => {
    it('devuelve undefined si el slug no existe', async () => {
      const repository = await makeRepository();
      await expect(repository.findBySlug(TeamSlug.of('inexistente'))).resolves.toBeUndefined();
    });

    it('guarda y recupera un equipo por slug', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-1', 'backend-team'));

      const reloaded = await repository.findBySlug(TeamSlug.of('backend-team'));
      expect(reloaded?.name.value).toBe('Backend Team');
      expect(reloaded?.hasTokenHash('hash-1')).toBe(true);
    });

    it('save() sustituye la versión anterior del mismo equipo', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-2', 'design-team'));
      await repository.save(
        Team.create({
          id: TeamId.of('team-2'),
          slug: TeamSlug.of('design-team'),
          name: TeamName.of('Design Team (renombrado)'),
          tokenHash: 'hash-2',
        }),
      );

      const reloaded = await repository.findBySlug(TeamSlug.of('design-team'));
      expect(reloaded?.name.value).toBe('Design Team (renombrado)');
      expect(reloaded?.hasTokenHash('hash-2')).toBe(true);
    });
    it('findById() recupera un equipo por su id', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-1', 'backend-team'));

      const reloaded = await repository.findById(TeamId.of('team-1'));

      expect(reloaded?.slug.value).toBe('backend-team');
      await expect(repository.findById(TeamId.of('inexistente'))).resolves.toBeUndefined();
    });

    it('listAll() devuelve todos los equipos ordenados por nombre', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-1', 'zeta', 'Zeta'));
      await repository.save(newTeam('team-2', 'alfa', 'Alfa'));

      const teams = await repository.listAll();

      expect(teams.map((team) => team.name.value)).toEqual(['Alfa', 'Zeta']);
    });

    it('delete() borra el equipo y deja de resolverlo por slug', async () => {
      const repository = await makeRepository();
      await repository.save(newTeam('team-1', 'backend-team'));
      await repository.save(newTeam('team-2', 'design-team'));

      await repository.delete(TeamId.of('team-1'));

      await expect(repository.findBySlug(TeamSlug.of('backend-team'))).resolves.toBeUndefined();
      expect((await repository.listAll()).map((team) => team.id.value)).toEqual(['team-2']);
    });
  });
}
