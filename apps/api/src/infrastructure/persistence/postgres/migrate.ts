import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { Pool } from 'pg';
import { requireDatabaseUrl } from './databaseUrl.js';
import { createDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFolder = path.join(__dirname, '../../../../migrations');

async function main(): Promise<void> {
  const direction = process.argv[2];
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Uso: migrate.ts <up|down>');
  }

  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const db = createDb(pool);
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
  });

  const { error, results } =
    direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();

  for (const result of results ?? []) {
    const marker = result.status === 'Success' ? '✓' : '✗';
    console.log(`${marker} ${result.migrationName}`);
  }

  await db.destroy();

  if (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
