# 0008 — Despliegue gestionado: Render + Cloudflare Pages + Supabase (bloque 10)

## Contexto

El bloque 9 (`docs/adr/0007-produccion-ci-cd.md`) cerró la producción asumiendo lo que decían
entonces `01-especificacion.md` §10 y `02-decisiones-y-plan.md` §1: **un VPS de Hetzner con
Dokploy**, con Postgres en el mismo servidor. De ahí salieron `deploy.yml` contra un webhook de
Dokploy y `docker-compose.prod.yml` como aplicación "Docker Compose" del panel.

Los documentos se han revisado priorizando **maximizar las opciones de despliegue gratuito**. Con la
base de datos fuera del contenedor, la API queda como un único proceso ligero (Node + Fastify +
Socket.IO) y encaja en plataformas gratuitas de un solo servicio que con Postgres al lado no
servían. El reparto vigente está en `docs/06-despliegue.md`: **API en Render, frontend en Cloudflare
Pages, Postgres en Supabase**. Este ADR recoge las decisiones de implementarlo.

Nada de esto toca `domain/`, `application/` ni `infrastructure/`: el único acoplamiento con el
proveedor de base de datos es `DATABASE_URL`. Que el giro cueste un workflow y unos documentos, y no
un refactor, es exactamente lo que compraba la arquitectura hexagonal.

## Decisiones

- **`deploy.yml` pasa de un job a tres encadenados: `migrate` → `deploy-api` → `deploy-web`.** El
  job de migraciones es un añadido sobre lo que especifica `03-ci-cd.md`, y es necesario: Render solo
  arranca una imagen ya construida, así que sin este paso nadie aplica las migraciones de Kysely
  contra Supabase y un despliegue puede quedarse con el esquema viejo. Reutiliza el `migrate:up` que
  ya existe desde el bloque 4, que solo exige `DATABASE_URL` (`requireDatabaseUrl()`), no el entorno
  completo de la app.
- **Consecuencia de ese orden: las migraciones deben ser aditivas.** `migrate` corre antes de que
  Render pulee la imagen nueva, así que durante unos segundos la versión anterior de la API habla con
  el esquema nuevo. Una migración destructiva (borrar o renombrar una columna en uso) rompería ese
  intervalo; lo que toca es el patrón de dos pasos — añadir, desplegar, y limpiar en una release
  posterior.
- **El tag de la imagen se normaliza quitando la `v` inicial.** `publish.yml` etiqueta con
  `type=semver,pattern={{version}}` de `docker/metadata-action`, que publica `…/api:0.3.0` para el
  tag `v0.3.0`. El borrador del workflow pedía a Render `…/api:${{ inputs.tag }}`, una imagen que no
  existe. `/health`, en cambio, sí devuelve el tag con `v`, porque `APP_VERSION` se inyecta con
  `github.event.release.tag_name` sin transformar: por eso el `grep` de la verificación usa el input
  tal cual y solo el `imgURL` lo recorta.
- **La verificación del despliegue espera en bucle con timeout (5 min) en vez de `sleep 40`.** El
  plan gratuito de Render arranca en frío; un tiempo fijo marcaría en rojo despliegues que solo eran
  lentos. Lo que no se negocia es que haya verificación: sin ella, un despliegue fallido queda verde.
- **`VITE_API_URL` y `VITE_WS_URL` se definen en el paso de build de `deploy-web`**, a partir de la
  variable `API_HOST` del repositorio. Son variables de build — Vite las congela dentro del bundle —
  y a Cloudflare Pages llega `apps/web/dist` ya construido vía Wrangler, así que definirlas en el
  dashboard de Cloudflare no tendría ningún efecto. El documento original no las definía en ningún
  sitio, y el bundle habría salido con `undefined` como base de la API.
- **`heartbeat.yml` es nuevo y trivial a propósito:** un `select 1;` diario contra Supabase para que
  el free tier no pause el proyecto tras 7 días sin actividad. Instala `postgresql-client` solo si el
  runner no trae `psql`.
- **`docker-compose.prod.yml` se borra.** Era la aplicación de Dokploy: imágenes de GHCR + Postgres
  en el mismo host. Con la BD en Supabase y la API en Render no tiene consumidor, y un fichero de
  producción que nadie despliega es una fuente de verdad falsa. Queda en el historial de git si algún
  día se vuelve al VPS. `docker-compose.yml` (desarrollo) y `docker-compose.ci.yml` no se tocan: el
  Postgres local sigue siendo el entorno de desarrollo y el de la suite de contrato.
- **`publish.yml` sigue publicando también la imagen `web`** aunque Cloudflare Pages no la use.
  Cuesta un job cacheado y es lo que permite volver al self-host sin rehacer el pipeline.
- **Al volcar los documentos revisados se conserva el git-flow `develop`/`main`.** Los textos
  actualizados de `02` y `03` parten de una revisión anterior al bloque 9 y revertían el flujo de dos
  ramas largas (y el `pr-title.yml` con `types:` como cadena separada por comas, que el ADR 0007
  documenta como bug real). Se ha fusionado: entra el contenido de hosting nuevo, se mantiene lo que
  el repositorio hace de verdad.

## Fuera de alcance de este bloque (pasos humanos)

- Crear el proyecto de Supabase, el Web Service de Render y el proyecto de Cloudflare Pages
  (`06-despliegue.md` §3-§5).
- Cargar `RENDER_DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y
  `SUPABASE_DATABASE_URL` en Settings → Secrets, y `API_HOST` en Settings → Variables.
- El Ruleset de `develop`/`main`, que sigue pendiente desde el bloque 9.

Hasta que eso exista, `deploy.yml` y `heartbeat.yml` están operativos pero inertes.

## Riesgos asumidos

- **Render free con "Existing image":** si el plan gratuito no admitiera desplegar una imagen
  preconstruida, el encaje es que Render construya desde el `Dockerfile` del repositorio y
  `deploy-api` dispare el hook sin `imgURL`. El resto del workflow no cambia.
- **TLS contra el pooler de Supabase:** el connection string debe llevar `sslmode=require`; si la
  verificación del certificado fallara, la salida es `sslmode=no-verify` en el propio string. No se
  añade configuración de proveedor a `db.ts`: el código se queda agnóstico.

## Consecuencias

- `.github/workflows/deploy.yml` reescrito y `.github/workflows/heartbeat.yml` nuevo;
  `docker-compose.prod.yml` desaparece del repositorio.
- `docs/06-despliegue.md` entra como documento vigente de producción, conviviendo con
  `docs/06-handoff-diseno.md` (mismo prefijo numérico, temas distintos: las referencias cruzadas de
  `01`, `02` y `03` ya apuntan a ese nombre).
- Del ADR 0007 quedan superadas la decisión de `docker-compose.prod.yml` y la de "dominio y SSL los
  resuelve Dokploy": ahora el dominio de la API lo da Render y el del front, Cloudflare Pages, cada
  uno con su certificado.
- `.env.example` documenta que en producción `DATABASE_URL` es el pooler de Supabase con
  `sslmode=require`. Las claves no cambian, así que `env.ts` tampoco.
