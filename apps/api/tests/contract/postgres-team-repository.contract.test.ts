import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { Team } from '../../src/domain/team/Team.js';
import { TeamId } from '../../src/domain/team/TeamId.js';
import { TeamName } from '../../src/domain/team/TeamName.js';
import { TeamSlug } from '../../src/domain/team/TeamSlug.js';
import { WebhookId } from '../../src/domain/team/WebhookId.js';
import { WebhookUrl } from '../../src/domain/team/WebhookUrl.js';
import { requireDatabaseUrl } from '../../src/infrastructure/persistence/postgres/databaseUrl.js';
import { createDb } from '../../src/infrastructure/persistence/postgres/db.js';
import { PostgresTeamRepository } from '../../src/infrastructure/persistence/postgres/PostgresTeamRepository.js';
import { defineTeamRepositoryContractTests } from './support/teamRepositoryContract.js';

const pool = new Pool({ connectionString: requireDatabaseUrl() });
const db = createDb(pool);

afterAll(async () => {
  await db.destroy();
});

defineTeamRepositoryContractTests(async () => {
  // Cascada a `decks.team_id` por la FK de la migración: no hace falta limpiar decks aparte.
  await db.deleteFrom('teams').execute();
  return new PostgresTeamRepository(db);
});

describe('PostgresTeamRepository: webhooks', () => {
  it('al borrar el equipo caen también sus webhooks (FK en cascada)', async () => {
    await db.deleteFrom('teams').execute();
    const repository = new PostgresTeamRepository(db);
    const team = Team.create({
      id: TeamId.of('team-cascada'),
      slug: TeamSlug.of('cascada'),
      name: TeamName.of('Cascada'),
      tokenHash: 'hash',
    }).addWebhook(
      WebhookId.of('hook-cascada'),
      WebhookUrl.of('https://hooks.example/cascada'),
      ['issue.estimated'],
      'secreto',
    );
    await repository.save(team);

    await repository.delete(team.id);

    const remaining = await db.selectFrom('team_webhooks').select('id').execute();
    expect(remaining).toEqual([]);
  });

  it('team_webhooks tiene activado el RLS, como el resto de tablas públicas (ADR 0013)', async () => {
    const result = await pool.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname = 'team_webhooks'",
    );

    expect(result.rows[0]?.relrowsecurity).toBe(true);
  });
});
