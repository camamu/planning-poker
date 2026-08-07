# Planning Poker

Herramienta interna de estimación ágil para un equipo de desarrollo: votación en vivo, barajas personalizadas, espectadores y temporizador de discusión. Sin cuentas — se entra por un enlace, se pone un nombre y se juega.

## Stack

- **Backend:** TypeScript / Node, [Fastify](https://fastify.dev), [Socket.IO](https://socket.io), Postgres vía [`pg`](https://node-postgres.com) + [Kysely](https://kysely.dev), [Zod](https://zod.dev) en el borde.
- **Frontend:** React + Vite + Tailwind, store con Zustand (bloque 6, aún no construido).
- **Monorepo:** pnpm workspaces (`apps/api`, `apps/web`, `packages/contracts`).
- **Arquitectura:** hexagonal / ports-and-adapters, con una barrera arquitectónica automatizada (`dependency-cruiser`) que impide que el dominio dependa de infraestructura o de frameworks.
- **Despliegue objetivo:** un VPS Hetzner con Dokploy, una sola instancia.

## Estado actual

**Bloques 1 y 2 completados.** Bloque 1: monorepo, TypeScript estricto, ESLint/Prettier, Vitest, barrera arquitectónica, hooks de commit, Docker (api + Postgres) con `/health` y `/ready`. Bloque 2: agregado `Game` y objetos de valor (`CardValue`, `Deck`, `RoundResult`, `Round`, `Participant`, `Issue`) con las 10 invariantes de negocio bajo test, sin BD ni HTTP (ver `docs/adr/0001-modelo-de-dominio-de-estimacion.md`). Todavía no hay casos de uso, repositorios, rutas HTTP más allá del health check, ni frontend.

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

`CLAUDE.md` (y `apps/web/CLAUDE.md`) recogen las reglas operativas para trabajar en el repo con Claude Code; no duplican el contenido de estos documentos.

## Flujo de trabajo

Una rama y una PR por bloque del plan (`feat/NN-nombre-del-bloque`), commits convencionales (`feat(scope): ...`, scopes: `domain`, `app`, `infra`, `web`, `contracts`, `ci`, `docker`, `deps`), sin `push` directo a `main` salvo el arranque inicial del repositorio. Toda decisión estructural genera un ADR corto en `docs/adr/`.
