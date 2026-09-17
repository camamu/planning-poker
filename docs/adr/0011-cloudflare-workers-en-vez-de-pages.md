# 0011 — Frontend en Cloudflare Workers en vez de Cloudflare Pages

## Contexto

`docs/06-despliegue.md` §5 (bloque 10, ADR `0008`) especificaba desplegar `apps/web` como proyecto
de **Cloudflare Pages**, con `deploy.yml` publicando vía `wrangler pages deploy
apps/web/dist --project-name=planning-poker`.

Al crear el recurso en el dashboard de Cloudflare siguiendo esa guía ("Pages → Upload assets"), la
cuenta (nueva, sin proyectos Pages previos) generó un **Worker con assets estáticos**
(`planning-poker.workers.dev`), no un proyecto Pages clásico (`*.pages.dev`) — comprobado con
`workers_list` (aparece como Worker) y con una petición directa a `planning-poker.pages.dev`
(no resuelve, no existe). Cloudflare lleva tiempo consolidando Pages dentro de Workers, y en cuentas
nuevas el propio asistente de "Pages" arma por debajo un Worker; ya no hay garantía de que "crear un
proyecto Pages" desde el dashboard cree, de hecho, un proyecto Pages.

Con `deploy.yml` sin cambios, `wrangler pages deploy` habría llamado a la API de Pages —un recurso
distinto del Worker ya creado— probablemente generando un segundo recurso `planning-poker` separado
en `*.pages.dev`, desconectado del que ya existía.

## Decisión

Adaptar el pipeline al recurso que Cloudflare realmente entrega hoy, en vez de forzar la ruta de
Pages clásica:

- `apps/web/wrangler.toml` nuevo: define el Worker (`name = "planning-poker"`, `[assets]` apuntando
  a `./dist`, `not_found_handling = "single-page-application"` para que las rutas del SPA no den
  404). Sin script de Worker — es un Worker solo-de-assets.
- `deploy.yml` (`deploy-web`): `wrangler deploy` (contra ese `wrangler.toml`) en vez de
  `wrangler pages deploy --project-name=...`.
- El **API Token** de Cloudflare necesita el permiso **Account → Workers Scripts → Edit**, no
  **Cloudflare Pages → Edit** (que es el que pedía la guía original) — son permisos distintos y el
  de Pages no autoriza `wrangler deploy`.
- `CORS_ORIGIN` en Render y las referencias a "el dominio de Cloudflare" en `docs/06-despliegue.md`
  pasan de `*.pages.dev` a `*.workers.dev`.

No hace falta borrar ni recrear nada: `wrangler deploy` actualiza en el sitio el Worker
`planning-poker` que ya existe (coincide por `name` en `wrangler.toml`).

## Consecuencias

- `docs/06-despliegue.md` §5 y §6 quedan actualizados a Workers; el título del documento también
  (era "Render + Cloudflare Pages + Supabase").
- Cualquier `CLOUDFLARE_API_TOKEN` generado siguiendo la guía original (permiso de Pages) hay que
  regenerarlo con el permiso de Workers Scripts antes del primer `deploy.yml` real tras esta PR.
- Si en el futuro se necesita lógica de servidor en el front (más allá de servir el SPA), este mismo
  Worker es el sitio natural para añadirla — no haría falta migrar de nuevo.
