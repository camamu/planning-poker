import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { requireDatabaseUrl } from '../../src/infrastructure/persistence/postgres/databaseUrl.js';
import { createDb } from '../../src/infrastructure/persistence/postgres/db.js';
import { PostgresGameHistoryReader } from '../../src/infrastructure/persistence/postgres/PostgresGameHistoryReader.js';
import { PostgresGameRepository } from '../../src/infrastructure/persistence/postgres/PostgresGameRepository.js';
import { PostgresTeamRepository } from '../../src/infrastructure/persistence/postgres/PostgresTeamRepository.js';
import { defineGameHistoryReaderContractTests } from './support/gameHistoryReaderContract.js';

const pool = new Pool({ connectionString: requireDatabaseUrl() });
const db = createDb(pool);

afterAll(async () => {
  await db.destroy();
});

defineGameHistoryReaderContractTests(async () => {
  // Primero las partidas: `games.team_id` apunta a `teams` y borrar el equipo solo la deja a null.
  await db.deleteFrom('games').execute();
  await db.deleteFrom('teams').execute();
  const games = new PostgresGameRepository(db);
  return {
    reader: new PostgresGameHistoryReader(db),
    teams: new PostgresTeamRepository(db),
    saveGameCreatedAt: async (game, createdAt) => {
      await games.save(game);
      await db
        .updateTable('games')
        .set({ created_at: createdAt })
        .where('id', '=', game.id.value)
        .execute();
    },
  };
});
