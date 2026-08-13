# Planning Poker

Herramienta interna de estimación ágil para un equipo de desarrollo: votación en vivo, barajas personalizadas, espectadores y temporizador de discusión. Sin cuentas — se entra por un enlace, se pone un nombre y se juega.

## Stack

- **Backend:** TypeScript / Node, [Fastify](https://fastify.dev), [Socket.IO](https://socket.io), Postgres vía [`pg`](https://node-postgres.com) + [Kysely](https://kysely.dev), [Zod](https://zod.dev) en el borde.
- **Frontend:** React + Vite + Tailwind, store con Zustand, `socket.io-client`.
- **Monorepo:** pnpm workspaces (`apps/api`, `apps/web`, `packages/contracts`).
- **Arquitectura:** hexagonal / ports-and-adapters, con una barrera arquitectónica automatizada (`dependency-cruiser`) que impide que el dominio dependa de infraestructura o de frameworks.
- **Despliegue objetivo:** API en Render, frontend en Cloudflare Pages, Postgres en Supabase (ver [`docs/06-despliegue.md`](docs/06-despliegue.md)).

## Estado actual

**Bloques 1 a 10 completados.** El agregado `Game` con sus 10 invariantes bajo test, los casos de uso sobre repositorio in-memory, la persistencia en Postgres con Kysely y su suite de contrato, el transporte HTTP + Socket.IO con la proyección filtrada por participante, el frontend completo de la mesa (votación, revelado, resultados, temporizador de discusión, emojis, espectadores), equipos con barajas personalizadas, y la CI/CD con versionado automático y despliegue gestionado. Cada bloque tiene su ADR en [`docs/adr/`](docs/adr).

Fuera de la v1, tal como fija `docs/02-decisiones-y-plan.md` §6: votación asíncrona, histórico y exportación, importación CSV/URL, cuentas reales e integraciones externas.

El plan completo por bloques está en [`docs/02-decisiones-y-plan.md`](docs/02-decisiones-y-plan.md) §5.

## Arrancar en local

```bash
pnpm install
pnpm dev              # docker compose up: levanta api + Postgres
curl localhost:3000/health
curl localhost:3000/ready
```

Requisitos: Node ≥22, pnpm ≥10, Docker con Compose v2. Variables de entorno documentadas en [`.env.example`](.env.example); se validan con zod al arrancar (`apps/api/src/infrastructure/config/env.ts`) y el proceso falla ruidosamente si falta alguna.

## Comandos

```bash
pnpm verify       # lint + typecheck + arch + test — lo mismo que corre la CI
pnpm lint         # eslint .
pnpm typecheck    # tsc --noEmit en cada workspace
pnpm arch         # barrera arquitectónica (dependency-cruiser)
pnpm test         # vitest en cada workspace
pnpm build        # build de cada workspace
```

## Despliegue: dónde vive cada pieza

| Pieza                 | Dónde                                    | Cómo llega ahí                                                                                               |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| API (`apps/api`)      | Web service en **Render** (free)         | Imagen `ghcr.io/camamu/planning-poker/api:<versión>` publicada por `publish.yml` y pulada por el deploy hook |
| Frontend (`apps/web`) | **Cloudflare Pages** (free)              | `apps/web/dist` construido en el propio workflow y publicado con Wrangler                                    |
| Base de datos         | **Supabase** (free), Postgres gestionado | Migraciones de Kysely aplicadas por el job `migrate` antes de cada despliegue                                |

El despliegue es **manual y por versión**: Actions → _Deploy_ → `workflow_dispatch` con el tag a desplegar (`v0.3.0`). Ese workflow migra la BD, dice a Render qué imagen pulear, comprueba que `/health` devuelve esa versión y solo entonces publica el front. `heartbeat.yml` hace un `select 1;` diario contra Supabase para que el free tier no pause el proyecto.

Dos cosas que conviene saber antes de una sesión de estimación: **Render free se duerme** por inactividad (abre el enlace un par de minutos antes; el primer arranque tarda), y **Supabase pausa el proyecto** a los 7 días sin actividad, de ahí el heartbeat. El detalle completo — creación de cuentas, variables de entorno, secretos y CORS entre dominios — está en [`docs/06-despliegue.md`](docs/06-despliegue.md).

## Documentación

Los documentos numerados en `docs/` son la fuente de verdad del proyecto:

| Doc                                                           | Contenido                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| [`00-setup-entorno.md`](docs/00-setup-entorno.md)             | Preparación del entorno de desarrollo                           |
| [`01-especificacion.md`](docs/01-especificacion.md)           | Especificación funcional y técnica, modelo de dominio           |
| [`02-decisiones-y-plan.md`](docs/02-decisiones-y-plan.md)     | Decisiones técnicas cerradas y plan de construcción por bloques |
| [`03-ci-cd.md`](docs/03-ci-cd.md)                             | CI/CD con GitHub Actions                                        |
| [`04-brief-diseno.md`](docs/04-brief-diseno.md)               | Brief de diseño (para Claude Design, no para Claude Code)       |
| [`05-estructura-frontend.md`](docs/05-estructura-frontend.md) | Estructura y fronteras de `apps/web`                            |
| [`06-despliegue.md`](docs/06-despliegue.md)                   | Despliegue en Render + Cloudflare Pages + Supabase              |
| [`06-handoff-diseno.md`](docs/06-handoff-diseno.md)           | Handoff de diseño Nocturne (material del bloque 6)              |

`CLAUDE.md` (y `apps/web/CLAUDE.md`) recogen las reglas operativas para trabajar en el repo con Claude Code; no duplican el contenido de estos documentos.

## Flujo de trabajo

Git-flow simplificado con dos ramas largas: `develop` (integración) y `main` (solo releases). Una rama y una PR por bloque del plan (`feat/NN-nombre-del-bloque`), siempre desde `develop` actualizado y contra `develop`; commits convencionales (`feat(scope): ...`, scopes: `domain`, `app`, `infra`, `web`, `contracts`, `ci`, `docker`, `deps`); sin `push` directo a `develop` ni a `main`. `main` solo avanza mergeando `develop` para cortar una release. Toda decisión estructural genera un ADR corto en `docs/adr/`.
