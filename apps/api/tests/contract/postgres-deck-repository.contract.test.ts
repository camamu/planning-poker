import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { requireDatabaseUrl } from '../../src/infrastructure/persistence/postgres/databaseUrl.js';
import { createDb } from '../../src/infrastructure/persistence/postgres/db.js';
import { PostgresDeckRepository } from '../../src/infrastructure/persistence/postgres/PostgresDeckRepository.js';
import { defineDeckRepositoryContractTests } from './support/deckRepositoryContract.js';

const pool = new Pool({ connectionString: requireDatabaseUrl() });
const db = createDb(pool);

afterAll(async () => {
  await db.destroy();
});

defineDeckRepositoryContractTests(async () => {
  // Solo las personalizadas: las dos de sistema las siembra la migración y deben sobrevivir.
  await db.deleteFrom('decks').where('team_id', 'is not', null).execute();
  await db.deleteFrom('teams').execute();
  // `decks.team_id` tiene FK a `teams.id`: los equipos que usa la suite compartida (team-1,
  // team-2) tienen que existir de verdad para que Postgres acepte guardar sus barajas.
  await db
    .insertInto('teams')
    .values([
      { id: 'team-1', slug: 'team-1', name: 'Team 1', token_hash: 'hash' },
      { id: 'team-2', slug: 'team-2', name: 'Team 2', token_hash: 'hash' },
    ])
    .execute();
  return new PostgresDeckRepository(db);
});
