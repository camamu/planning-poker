# ADR 0013 — RLS activada en las tablas del esquema `public`

## Contexto

Supabase expone `public` vía PostgREST a cualquiera que tenga la URL del proyecto y la clave anon.
Sin Row-Level Security, esa clave puede leer, editar y borrar todas las tablas (advisor
`rls_disabled_in_public`). La API no usa PostgREST: habla con Postgres por `pg`/Kysely con el rol
propietario (ver `docs/06-despliegue.md` §3), que ignora RLS.

## Decisión

La migración `0005_enable_rls` activa RLS en las tablas de negocio y en `kysely_migration` /
`kysely_migration_lock`, **sin políticas**. Con RLS y sin políticas, `anon` y `authenticated` no ven
ni tocan nada; la API sigue funcionando porque el rol propietario la omite.

## Consecuencias

- Toda tabla nueva debe activar RLS en su propia migración.
- Si algún día se usara el SDK de Supabase desde el cliente, habría que diseñar políticas; hoy está
  descartado (`docs/06-despliegue.md` §3.6).
- Los tests contra Postgres local no cambian: el rol de la BD local es superusuario/propietario.
