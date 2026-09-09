/**
 * Fuera de main.ts, ni las migraciones ni los tests de contrato necesitan (ni deben exigir) el
 * resto de la configuración de la app validada por `loadEnv()` (CORS_ORIGIN, SESSION_SECRET...):
 * solo hablan con Postgres. El job de CI de `docs/03-ci-cd.md` para la suite de contrato solo
 * define DATABASE_URL, y así se queda esta lectura.
 */
export function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL no está definida.');
  return value;
}
