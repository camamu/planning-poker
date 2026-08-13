import { Pool } from 'pg';
import { afterAll } from 'vitest';
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
