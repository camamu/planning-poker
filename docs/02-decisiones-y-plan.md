# Planning Poker — Decisiones técnicas y plan de construcción

**Complementa a:** `01-especificacion.md`
**Contexto fijado:** TypeScript/Node · herramienta interna para el equipo · MVP = votación en vivo + barajas personalizadas

---

## 1. Decisiones cerradas

| Punto                     | Decisión                                                                                       | Por qué                                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                   | Node 22 LTS, TypeScript en `strict`                                                            | —                                                                                                                                                                                                                                                        |
| HTTP                      | **Fastify**                                                                                    | Ligero y no impone estructura. NestJS traería decoradores y su DI, y la tentación de meterlos en el dominio; para hexagonal pura estorba más que ayuda                                                                                                   |
| Inyección de dependencias | **Composition root manual** en `main.ts`                                                       | Con ~13 casos de uso no hace falta contenedor. Cablear a mano deja el grafo visible y los tests triviales                                                                                                                                                |
| Tiempo real               | **Socket.IO**                                                                                  | Rooms, reconexión y acks resueltos. Supabase Realtime acoplaría el canal a un proveedor sin ganar nada aquí                                                                                                                                              |
| Persistencia              | **Postgres en el propio `docker-compose`**, acceso con `pg` + **Kysely**                       | Al ser herramienta interna, Supabase aporta poco: ya tienes el contenedor. Kysely es un query builder tipado, no un ORM: los mappers persistencia↔dominio quedan explícitos, que es justo lo que la hexagonal necesita. Prisma pelearía contra ese mapeo |
| Migraciones               | Kysely migrations, versionadas en `apps/api/migrations`                                        | —                                                                                                                                                                                                                                                        |
| Validación de borde       | **Zod** en `packages/contracts`                                                                | El mismo esquema valida en API y tipa el front                                                                                                                                                                                                           |
| Tests                     | **Vitest**                                                                                     | Rápido, mismo tooling en api y web                                                                                                                                                                                                                       |
| Frontend                  | **React + Vite + Tailwind**, store con Zustand, `socket.io-client`                             | —                                                                                                                                                                                                                                                        |
| Barrera arquitectónica    | **dependency-cruiser** en CI                                                                   | Falla el build si `domain/` importa framework                                                                                                                                                                                                            |
| Autenticación             | Sin cuentas. URL de partida (UUIDv4) + token de facilitador + cookie de sesión de participante | El equipo cabe en un link de Slack                                                                                                                                                                                                                       |
| Despliegue                | **1 VPS Hetzner (CX22, ~5 €/mes) + Dokploy**, una sola instancia                               | Sin Redis en v1: con una instancia el broadcast en memoria basta. El puerto `RealtimeBroadcaster` queda por si algún día hacen falta dos                                                                                                                 |

**Supabase queda descartado para este proyecto**, no por calidad sino por encaje: su valor está en Auth + Realtime + BD gestionada para apps sin backend propio, y aquí tienes backend propio, cero cuentas y un contenedor ya montado. Si en algún momento no queréis administrar el servidor, la migración es cambiar `DATABASE_URL` — el dominio ni se entera.

---

## 2. Consecuencia no obvia: dónde viven las barajas personalizadas

Meter F4 en el MVP sin cuentas crea un problema de propiedad: **una baraja personalizada es un dato que sobrevive a la partida, pero no hay usuario al que pertenecer.**

Tres salidas:

| Opción                                       | Coste  | Problema                                                              |
| -------------------------------------------- | ------ | --------------------------------------------------------------------- |
| a) Baraja solo de esa partida                | Nulo   | Hay que reescribirla cada sprint. Mata el valor de la funcionalidad   |
| b) Guardar en `localStorage` del facilitador | Bajo   | Se pierde al cambiar de navegador; no se comparte entre facilitadores |
| c) **Concepto de `Team` ligero**             | ~1 día | Ninguno grave                                                         |

**Recomendación: (c).** Un `Team` es una fila con `slug` y `token`, sin registro ni email. El equipo guarda un link tipo `/t/backend-team?k=<token>`; las barajas y los ajustes por defecto cuelgan de ahí, y las partidas se crean dentro del equipo. Es el 20% de un sistema de cuentas con el 90% del beneficio, y deja el camino abierto a añadir login real en v2 sin volver a modelar nada.

Añadido al esquema:

```sql
create table teams (
  id         uuid primary key,
  slug       text not null unique,
  name       text not null,
  token_hash text not null,
  created_at timestamptz not null default now()
);

create table decks (
  id         uuid primary key,
  team_id    uuid references teams(id) on delete cascade,  -- null = baraja del sistema
  slug       text,             -- solo para las de sistema
  name       text not null,
  cards      jsonb not null,   -- [{"raw":"XS"}, ...] en orden de presentación
  created_at timestamptz not null default now()
);
create unique index system_deck_slug on decks (slug) where team_id is null;

alter table games add column team_id uuid references teams(id) on delete set null;
```

**Importante:** la partida **copia** la baraja en su columna `deck` (jsonb) al crearse. Si alguien edita la baraja del equipo, las partidas ya jugadas no cambian de significado. Es el mismo principio que copiar el precio en una línea de pedido.

### 2.1 Barajas de sistema (las dos que se crean de fábrica)

`team_id = null` marca la baraja como de sistema: visible para todos, no editable ni borrable desde la UI.

| Slug        | Nombre    | Cartas                                  |
| ----------- | --------- | --------------------------------------- |
| `fibonacci` | Fibonacci | `0.5` `1` `2` `3` `5` `8` `13` `?` `☕` |
| `tshirt`    | Tallas    | `XS` `S` `M` `L` `XL` `XXL` `?` `☕`    |

- `?` y `☕` se añaden **siempre** al construir cualquier baraja, también las personalizadas. No son datos de entrada: los pone `Deck`.
- En `fibonacci` las siete cartas son numéricas y entran en media y acuerdo.
- En `tshirt` **ninguna** carta es numérica: `average` es `null` y la UI debe ocultar la media en vez de pintar `NaN`. Esto necesita su propio test.
- El orden de las cartas es el de la tabla y es significativo: la UI las pinta en ese orden.

Migración de seed:

```sql
insert into decks (id, team_id, slug, name, cards) values
  (gen_random_uuid(), null, 'fibonacci', 'Fibonacci',
   '[{"raw":"0.5"},{"raw":"1"},{"raw":"2"},{"raw":"3"},{"raw":"5"},{"raw":"8"},{"raw":"13"},{"raw":"?"},{"raw":"☕"}]'::jsonb),
  (gen_random_uuid(), null, 'tshirt', 'Tallas',
   '[{"raw":"XS"},{"raw":"S"},{"raw":"M"},{"raw":"L"},{"raw":"XL"},{"raw":"XXL"},{"raw":"?"},{"raw":"☕"}]'::jsonb)
on conflict (slug) where team_id is null do nothing;
```

Las factorías del dominio (`Deck.fibonacci()`, `Deck.tshirt()`) devuelven exactamente estos valores y son la fuente de verdad; el seed de BD existe solo para que el selector de barajas del front las liste con las custom en una sola consulta.

---

## 3. Estructura del monorepo

```
planning-poker/
├── pnpm-workspace.yaml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .dependency-cruiser.cjs
├── packages/
│   └── contracts/src/
│       ├── events.ts          # union de eventos servidor→cliente
│       ├── commands.ts        # esquemas zod cliente→servidor
│       └── views.ts           # DTOs de proyección
├── apps/
│   ├── api/
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── shared/            DomainError.ts · Clock.ts (tipo) · DomainEvent.ts
│   │   │   │   ├── deck/              Deck.ts · CardValue.ts
│   │   │   │   ├── team/              Team.ts · TeamId.ts
│   │   │   │   └── game/
│   │   │   │       ├── Game.ts        ← el agregado, el fichero más importante del repo
│   │   │   │       ├── Round.ts · Issue.ts · Participant.ts
│   │   │   │       ├── RoundResult.ts
│   │   │   │       └── events/
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── GameRepository.ts · DeckRepository.ts
│   │   │   │   │   ├── RealtimeBroadcaster.ts · EventPublisher.ts
│   │   │   │   │   └── Clock.ts · IdGenerator.ts
│   │   │   │   └── use-cases/
│   │   │   │       ├── CreateGame.ts · JoinGame.ts · CastVote.ts
│   │   │   │       ├── RevealRound.ts · StartVotingRound.ts
│   │   │   │       ├── SaveCustomDeck.ts · GetGameStateFor.ts ...
│   │   │   └── infrastructure/
│   │   │       ├── http/routes/ · http/schemas/
│   │   │       ├── realtime/SocketIoGateway.ts · SocketIoBroadcaster.ts
│   │   │       ├── persistence/postgres/  (repos + mappers + Kysely types)
│   │   │       ├── persistence/in-memory/
│   │   │       └── config/env.ts
│   │   ├── src/main.ts                ← composition root
│   │   └── tests/
│   │       ├── domain/                unitarios puros
│   │       ├── use-cases/             con in-memory
│   │       ├── contract/              misma suite contra in-memory y postgres
│   │       └── e2e/
│   └── web/
```

---

## 4. Piezas de referencia

### 4.1 `CardValue` — el VO que sostiene media y acuerdo

```ts
export class CardValue {
  private constructor(
    readonly raw: string,
    readonly numeric: number | null,
    readonly special: boolean,
  ) {}

  static of(raw: string): CardValue {
    const trimmed = raw.trim();
    if (trimmed.length === 0) throw new InvalidCardValueError(raw);
    if (trimmed === '?' || trimmed === '☕') return new CardValue(trimmed, null, true);
    const parsed = Number(trimmed);
    return new CardValue(trimmed, Number.isFinite(parsed) ? parsed : null, false);
  }

  countsForAverage(): boolean {
    return !this.special && this.numeric !== null;
  }
  equals(other: CardValue): boolean {
    return this.raw === other.raw;
  }
}
```

`countsForAverage()` es lo que impide que `?` y el café contaminen la media y el porcentaje de acuerdo. Vive en el dominio, no en el front.

### 4.2 `Game.castVote` — invariantes 1-4 en un método

```ts
castVote(participantId: ParticipantId, card: CardValue, now: Date): void {
  const participant = this.requireParticipant(participantId);
  if (participant.isSpectator()) throw new SpectatorCannotVoteError(participantId);
  if (!this.deck.contains(card)) throw new CardNotInDeckError(card);

  const round = this.openRound();
  if (!round) throw new NoOpenRoundError(this.id);

  if (round.hasSameVote(participantId, card)) return;   // idempotencia

  round.castVote(participantId, card, now);
  this.record(new VoteCast(this.id, round.id, participantId, now));

  if (this.settings.autoReveal && round.everyVoterHasVoted(this.voters())) {
    this.reveal(participantId, now);
  }
}
```

Fíjate en que el caso de uso `CastVote` no decide nada: carga, llama, guarda, publica. Si algún día ves un `if` de negocio en `application/`, se ha escapado del agregado.

### 4.3 Proyección filtrada — la invariante 7

```ts
export function toGameView(game: Game, viewerId: ParticipantId): GameView {
  const round = game.currentRound();
  const revealed = round?.isRevealed() ?? false;

  return {
    // ...
    votes:
      round?.votes().map((v) => ({
        participantId: v.participantId.value,
        // el valor SOLO existe tras el reveal, o si es tu propio voto
        card: revealed || v.participantId.equals(viewerId) ? v.card.raw : null,
        hasVoted: true,
      })) ?? [],
    result: revealed ? round!.result().toView() : null,
  };
}
```

Esta función es el único punto por el que un voto puede salir del servidor. Un test e2e que inspeccione el payload crudo del socket antes del reveal la protege.

---

## 5. Orden de construcción

Cada bloque es una PR con valor propio.

| #   | Bloque                        | Entregable                                                                                                                                                                                        |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Esqueleto                     | Monorepo pnpm, TS strict, Vitest, dependency-cruiser con la regla de dominio verde, `docker-compose` levantando api+db, **workflows de CI y release** (ver `00-setup-entorno.md` y `03-ci-cd.md`) |
| 2   | Dominio de estimación         | `CardValue`, `Deck`, `Game`, `Round`, `RoundResult`. **Sin BD, sin HTTP.** Tests de las 10 invariantes. Aquí es donde el proyecto se gana o se pierde                                             |
| 3   | Casos de uso + repo in-memory | Crear partida, unirse, abrir ronda, votar, revelar. Todo verde sin infraestructura                                                                                                                |
| 4   | Persistencia Postgres         | Migraciones, Kysely, mappers, suite de contrato corriendo contra ambos repos                                                                                                                      |
| 5   | HTTP + WebSocket              | Fastify, Socket.IO, proyección filtrada, `state_sync` con `version`                                                                                                                               |
| 6   | Frontend de la mesa           | Crear/unirse/votar/revelar, animación de giro, resultados, confeti                                                                                                                                |
| 7   | Equipos y barajas             | `Team`, `decks`, selector de baraja, editor de barajas custom                                                                                                                                     |
| 8   | Temporizador y espectadores   | F8 y F9                                                                                                                                                                                           |
| 9   | Producción                    | Dockerfile multi-stage, healthchecks, Dokploy en el VPS, dominio y SSL                                                                                                                            |

Los bloques 2 y 3 no tocan una sola librería externa. Si en el bloque 5 tienes que modificar algo de `domain/` para que Fastify o Socket.IO encajen, algo se hizo mal antes.

---

## 6. Lo que dejaría explícitamente fuera de la v1

Votación asíncrona, histórico y exportación, importación CSV/URL, cuentas reales, y cualquier integración. Ninguna requiere rediseño para entrar después: async es un `RoundStatus` extra y un reveal en lote; el histórico ya está en `voting_rounds`, solo falta la vista.
