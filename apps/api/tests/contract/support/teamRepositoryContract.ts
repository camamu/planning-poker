import { describe, expect, it } from 'vitest';
import type { TeamRepository } from '../../../src/application/ports/TeamRepository.js';
import { Team } from '../../../src/domain/team/Team.js';
import { TeamId } from '../../../src/domain/team/TeamId.js';
import { TeamName } from '../../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../../src/domain/team/TeamSlug.js';
import { WebhookId } from '../../../src/domain/team/WebhookId.js';
import { WebhookUrl } from '../../../src/domain/team/WebhookUrl.js';

function newTeam(id: string, slug: string, name = 'Backend Team'): Team {
  return Team.create({
    id: TeamId.of(id),
    slug: TeamSlug.of(slug),
    name: TeamName.of(name),
    tokenHash: 'hash-1',
  });
}

function withWebhook(team: Team, id: string, events: Parameters<Team['addWebhook']>[2]): Team {
  return team.addWebhook(
    WebhookId.of(id),
    WebhookUrl.of(`https://hooks.example/${id}`),
    events,
    `secreto-${id}`,
  );
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

    it('guarda y recupera los webhooks de un equipo con su url, eventos y secreto', async () => {
      const repository = await makeRepository();
      await repository.save(
        withWebhook(newTeam('team-1', 'backend-team'), 'hook-1', [
          'issue.estimated',
          'session.summary',
        ]),
      );

      const bySlug = await repository.findBySlug(TeamSlug.of('backend-team'));
      const byId = await repository.findById(TeamId.of('team-1'));

      for (const reloaded of [bySlug, byId]) {
        const [webhook] = reloaded?.webhooks ?? [];
        expect(reloaded?.webhooks).toHaveLength(1);
        expect(webhook?.id.value).toBe('hook-1');
        expect(webhook?.url.value).toBe('https://hooks.example/hook-1');
        expect(webhook?.events).toEqual(['issue.estimated', 'session.summary']);
        expect(webhook?.secret).toBe('secreto-hook-1');
      }
    });

    it('conserva el orden en que se añadieron los webhooks aunque se guarden en momentos distintos', async () => {
      const repository = await makeRepository();
      let team = newTeam('team-1', 'backend-team');
      for (const id of ['zeta', 'alfa', 'media']) {
        team = withWebhook(team, id, ['issue.estimated']);
        await repository.save(team);
      }

      const reloaded = await repository.findById(TeamId.of('team-1'));

      expect(reloaded?.webhooks.map((webhook) => webhook.id.value)).toEqual([
        'zeta',
        'alfa',
        'media',
      ]);
    });

    it('guardar un equipo sin un webhook que tenía lo borra y deja los demás', async () => {
      const repository = await makeRepository();
      let team = newTeam('team-1', 'backend-team');
      for (const id of ['a', 'b', 'c']) team = withWebhook(team, id, ['issue.estimated']);
      await repository.save(team);

      await repository.save(team.removeWebhook(WebhookId.of('b')));

      const reloaded = await repository.findById(TeamId.of('team-1'));
      expect(reloaded?.webhooks.map((webhook) => webhook.id.value)).toEqual(['a', 'c']);
    });

    it('guardar dos veces el mismo equipo no duplica sus webhooks', async () => {
      const repository = await makeRepository();
      const team = withWebhook(newTeam('team-1', 'backend-team'), 'a', ['issue.estimated']);

      await repository.save(team);
      await repository.save(team);

      expect((await repository.findById(TeamId.of('team-1')))?.webhooks).toHaveLength(1);
    });

    it('renombrar un equipo o cambiar su token no pierde sus webhooks', async () => {
      const repository = await makeRepository();
      const team = withWebhook(newTeam('team-1', 'backend-team'), 'a', ['issue.estimated']);
      await repository.save(team);

      await repository.save(team.rename(TeamName.of('Otro nombre')).rotateToken('hash-9'));

      const reloaded = await repository.findById(TeamId.of('team-1'));
      expect(reloaded?.name.value).toBe('Otro nombre');
      expect(reloaded?.webhooks.map((webhook) => webhook.id.value)).toEqual(['a']);
    });

    it('listAll() trae a cada equipo con sus propios webhooks', async () => {
      const repository = await makeRepository();
      await repository.save(
        withWebhook(newTeam('team-1', 'alfa', 'Alfa'), 'a', ['issue.estimated']),
      );
      await repository.save(newTeam('team-2', 'zeta', 'Zeta'));
      await repository.save(
        withWebhook(newTeam('team-3', 'media', 'Media'), 'm', ['session.summary']),
      );

      const teams = await repository.listAll();

      expect(teams.map((team) => [team.slug.value, team.webhooks.map((w) => w.id.value)])).toEqual([
        ['alfa', ['a']],
        ['media', ['m']],
        ['zeta', []],
      ]);
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
