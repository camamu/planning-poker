# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Planning Poker — an internal, no-account estimation tool for a team (live voting, custom decks, spectators, discussion timer). TypeScript/Node monorepo, hexagonal architecture, dockerized.

The numbered docs in `docs/` are the source of truth and are not summarized here — read them, don't rely on this file for their content:
`00` entorno · `01` especificación funcional · `02` decisiones técnicas y plan por bloques · `03` CI/CD · `04` brief de diseño (material para Claude Design, not for Claude Code) · `05` estructura y fronteras de `apps/web`.

**Before starting a new block of the plan:** read `docs/02-decisiones-y-plan.md` §5 and whichever doc(s) that block references.

The project is built in ordered blocks (see `docs/02-decisiones-y-plan.md` §5). As of now only **block 1 (skeleton)** is done: monorepo, tooling, architectural barrier, Docker skeleton, health/readiness endpoints. No domain model, use cases, HTTP routes beyond health, or frontend exist yet.

## Commands

```bash
pnpm install               # install deps (pnpm via Homebrew; corepack is not bundled in this Node build)
pnpm verify                 # lint + typecheck + arch + test — run this before considering any change done
pnpm lint                   # eslint . (flat config, typescript-eslint strictTypeChecked)
pnpm typecheck               # pnpm -r typecheck (each workspace runs tsc --noEmit)
pnpm arch                    # dependency-cruiser barrier over apps/api/src and apps/web/src
pnpm test                    # pnpm -r test (vitest run per workspace)
pnpm --filter @pp/api test:unit      # vitest run tests/domain tests/use-cases (no DB, no HTTP)
pnpm --filter @pp/api test:contract  # vitest run tests/contract (same suite against in-memory + Postgres repos, once they exist)
pnpm --filter @pp/api test:e2e       # vitest run tests/e2e
pnpm --filter @pp/api exec vitest run tests/domain/some.test.ts   # single test file
pnpm --filter @pp/api exec vitest run -t "nombre del test"        # single test by name
pnpm dev                    # docker compose up (api + db)
docker compose up -d --build && docker compose logs -f api
```

`pnpm verify` is exactly what CI will run — if a check isn't in that command, it isn't gating anything.

## Architecture

Hexagonal / ports-and-adapters, enforced mechanically, not by convention. `apps/api/src/`:

- `domain/` — the aggregate `Game` and its invariants. Zero framework imports, zero `Date.now()`/filesystem/network. Time comes in only via a `Clock` port.
- `application/` — thin use cases (load aggregate → invoke domain method → persist → publish events) plus `ports/` (driving + driven interfaces). A use case with an `if` deciding business rules is a bug — that logic belongs in the aggregate.
- `infrastructure/` — everything concrete: HTTP (Fastify), realtime (Socket.IO), persistence (Postgres/Kysely + an in-memory implementation for tests), config/env.
- `main.ts` — the only composition root. It's the only file allowed to wire concrete infrastructure implementations together (enforced by dependency-cruiser's `solo-main-cablea` rule).

**`.dependency-cruiser.cjs` is the architectural barrier**, run via `pnpm arch`. Rules: `domain/` cannot import from `application/`/`infrastructure/`/external libs; `application/` cannot import from `infrastructure/`; only `main.ts` may import concrete `Repository`/`Broadcaster` implementations from `infrastructure/persistence` or `infrastructure/realtime`; no circular deps. If you touch `domain/` and `pnpm arch` doesn't complain when it should, the config's `tsConfig.fileName` must stay an absolute path (`path.join(__dirname, 'apps/api/tsconfig.json')`) — a relative path there fails to resolve `tsconfig.base.json`'s `extends` when invoked from the repo root.

Domain aggregate shape (target, not yet built) is fully specified in `docs/01-especificacion.md` §3: `Game` owns `Participants`, `Issues`, `VotingRounds`; `CardValue`/`Deck`/`RoundResult` are the key value objects. The 10 numbered business invariants there (one vote per participant, no voting on revealed rounds, votes hidden until reveal, etc.) are the test list for the domain block — one test per invariant, named after the rule (`no permite votar a un espectador`), not the method.

### Monorepo layout

pnpm workspace, 3 packages: `@pp/api` (Fastify backend), `@pp/web` (folder skeleton only — no `package.json`, no Vite/React/Tailwind yet; those land in block 6), `@pp/contracts` (shared zod schemas/types between api and web — currently just a placeholder export). `packages/contracts` is meant to hold `events.ts`/`commands.ts`/`views.ts` once the WS contract is implemented.

`apps/web/src/` mirrors the backend's hexagonal split with different names: `design-system/` (pure, no business knowledge — the equivalent of `domain/`), `features/` (equivalent of `application/`), `shared/` (equivalent of `infrastructure/` — API client, socket, store). Rules and rationale in `apps/web/CLAUDE.md` and `docs/05-estructura-frontend.md`.

### Test layout (`apps/api/tests/`)

`domain/` and `use-cases/` — fast, no infra, run by `test:unit`. `contract/` — same repository test suite run against both the in-memory and the Postgres adapter. `e2e/` — real stack, two WebSocket clients. The mandatory e2e test once sockets exist: verify the raw WS payload never contains another participant's vote value before reveal (invariant 7 — the one whose failure is invisible in the UI).

## Stack decisions (locked, see `docs/02-decisiones-y-plan.md` §1)

Fastify · Socket.IO · Postgres via `pg` + Kysely (query builder, not an ORM — mappers stay explicit) · Zod for edge validation in `packages/contracts` · Vitest · React + Vite + Tailwind + Zustand for the frontend (not built yet) · manual composition root in `main.ts` (no DI container) · no accounts, URL-based auth with a facilitator token.

## Environment / config

`apps/api/src/infrastructure/config/env.ts` validates `process.env` with zod at startup and throws loudly if anything is missing (`DATABASE_URL`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `LOG_LEVEL`, `SESSION_SECRET`). Nothing else in the codebase should read `process.env` directly. `.env.example` documents all keys; real `.env` is gitignored.

The `pg.Pool` in `main.ts` has a `.on('error', ...)` handler — without it, an idle client error (e.g. the DB container going down) crashes the whole Node process instead of `/ready` degrading to 503. Don't remove it.

## Permanent rules (apply to every block, not just setup)

1. No framework/library imports in `domain/` — not zod, not Fastify, not the Postgres driver, not `Date.now()`.
2. No `any`, no `as` to silence the compiler. If the type doesn't fit, the model is wrong.
3. Use cases don't decide business rules — they load, invoke a domain method, persist, publish.
4. One test per invariant, named after the rule, not the method under test.
5. No comments explaining _what_ code does — only _why_, for non-obvious decisions.
6. Domain names stay in English in code; ubiquitous language (`revelar`/`reveal`, `facilitador`, `ronda`) is documented in `docs/adr`.
7. Every structural decision gets an ADR in `docs/adr/NNNN-titulo.md` (context, decision, consequences — half a page).
8. **Never push directly to `main`.** One branch + PR per plan block, named `feat/NN-nombre-del-bloque`, CI green before merge. **Never merge the PR yourself** — leave it ready (or in draft while still working) and stop there; the merge belongs to the human. (`docs/03-ci-cd.md` specifies the intended GitHub Actions workflows and branch protection — not yet implemented; `.github/workflows/` currently only exists as an empty placeholder directory.)
9. Conventional commits: `feat(scope): ...`. Valid scopes: `domain`, `app`, `infra`, `web`, `contracts`, `ci`, `docker`, `deps` (enforced by commitlint, see `commitlint.config.js`).

## Frontend

`apps/web/CLAUDE.md` holds that folder's own dependency rules and loads automatically when working on files inside it — don't duplicate its content here. Design work itself (Claude Design handoff, actual components) is block 6; only the folder skeleton and its architectural barrier exist so far.

## Estado

Bloque actual del plan: 1 (esqueleto + CI). Actualiza esta línea al cerrar cada bloque.

## Known local-environment gotchas

- Node here is 26.x (newer than the 22 LTS the docs assume) and doesn't bundle corepack — pnpm is installed via Homebrew, not `corepack enable`.
- TypeScript is pinned to `6.0.3` in root `devDependencies`, not the installed-but-newer `7.x`, because `typescript-eslint` doesn't yet support TS 7's peer range.
- `pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }` — pnpm gates postinstall scripts by default; esbuild (a vitest/tsx transitive dep) needs it.
- Docker builds use `node:26-alpine` (matching the local Node) with `npm install -g pnpm` in the base stage, for the same corepack reason as above.
