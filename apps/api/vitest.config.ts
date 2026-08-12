import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@pp/api',
    environment: 'node',
    // tests/contract/postgres-*.contract.test.ts comparten un único Postgres real y hacen
    // DELETE + INSERT sobre las mismas filas (p. ej. team-1/team-2) entre archivos: en paralelo
    // eso es una carrera de verdad (visto como "duplicate key value violates... teams_pkey"),
    // no un fallo intermitente del entorno.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
