import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { requireDatabaseUrl } from '../../src/infrastructure/persistence/postgres/databaseUrl.js';
import { createDb } from '../../src/infrastructure/persistence/postgres/db.js';
import { PostgresGameRepository } from '../../src/infrastructure/persistence/postgres/PostgresGameRepository.js';
import { defineGameRepositoryContractTests } from './support/gameRepositoryContract.js';

const pool = new Pool({ connectionString: requireDatabaseUrl() });
const db = createDb(pool);

afterAll(async () => {
  await db.destroy();
});

defineGameRepositoryContractTests(async () => {
  // DELETE FROM games cascada a participants/issues/rounds/votes por las FK de la migración.
  await db.deleteFrom('games').execute();
  return new PostgresGameRepository(db);
});
