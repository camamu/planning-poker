# Planning Poker — Especificación funcional y técnica

**Versión:** 0.1 (borrador para validar)
**Fecha:** agosto 2026
**Referencia analizada:** planningpokeronline.com (web app + plugin Jira)

---

## 1. Análisis del producto de referencia

### 1.1 Funcionalidades extraídas

**Estimación (núcleo)**

| #   | Funcionalidad             | Detalle observado                                                                                                                                     |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Votación en tiempo real   | El facilitador abre una issue, cada jugador elige carta, los votos quedan ocultos y todas las cartas se giran a la vez para evitar anclaje            |
| F2  | Votación asíncrona        | Los votos se guardan por issue; alguien vota el lunes y otro el martes. El facilitador revela una issue o todas las que tengan votos async de golpe   |
| F3  | Barajas predefinidas      | Fibonacci, Fibonacci modificada, potencias de 2, tallas de camiseta, estimación original en horas/días/semanas. Todas incluyen carta `?` y carta café |
| F4  | Barajas personalizadas    | Valores propios, numéricos o texto, reutilizables entre partidas                                                                                      |
| F5  | Countdown y auto-reveal   | Cuenta atrás antes de girar; giro automático cuando todos han votado. Ambos configurables por partida                                                 |
| F6  | Resultados y estadísticas | Distribución de votos, quién votó qué, media (solo cartas numéricas, ocultable), % de acuerdo con gráfico, confeti si unanimidad                      |
| F7  | Histórico y exportación   | Rondas agrupadas por sesión con issue, resultado, media y carta más votada. Exportable                                                                |
| F8  | Temporizador de discusión | Timer compartido, iniciar/pausar/reiniciar, añadir tiempo, duración editable, reinicio por issue, sonido al acabar                                    |
| F9  | Modo espectador           | Participa sin votar; queda fuera del recuento, la media y el acuerdo                                                                                  |

**Gestión de partida y equipo**

| #   | Funcionalidad                | Detalle observado                                                                                               |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| F10 | Gestión de issues en sesión  | Sidebar para crear, ordenar, editar y marcar issues                                                             |
| F11 | Roles y permisos por partida | Quién puede revelar y editar issues: todos o una lista concreta. Traspaso de facilitador sin recrear la partida |
| F12 | Múltiples facilitadores      | Modelo de asientos (seats) de pago; los jugadores nunca ocupan asiento                                          |
| F13 | Invitación por link o QR     | URL permanente y reutilizable por sprint                                                                        |
| F14 | Entrada sin cuenta           | El jugador solo pone un nombre; solo el creador necesita cuenta (Google, Microsoft, email)                      |
| F15 | Listado de partidas          | Dashboard personal de partidas creadas y recientes                                                              |

**Integraciones**

| #   | Funcionalidad                                                           |
| --- | ----------------------------------------------------------------------- |
| F16 | Importación/exportación CSV (summary, key, description, link, estimate) |
| F17 | Importación pegando URLs de issues                                      |
| F18 | Linear vía OAuth, con escritura de estimación de vuelta                 |
| F19 | Jira solo mediante plugin de Marketplace (fuera de la web app)          |

**Modelo de negocio observado (referencia, no obligatorio replicar)**

- Gratis: jugadores ilimitados, 9 votaciones y 5 issues votadas por partida, importación CSV, URLs permanentes.
- Premium: ~30 $/facilitador/mes o 300 $/año, sin límites, con histórico y reanudación de partidas.

### 1.2 Qué copiamos, qué cambiamos

| Decisión                     | Propuesta                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integración Jira/Linear      | **Fuera del MVP.** CSV + pegado de URLs cubre el 90% del valor con el 5% del coste                                                                                                      |
| Cuentas de usuario           | El facilitador puede jugar **sin cuenta** en el MVP (link secreto de facilitador). Cuentas en v2                                                                                        |
| Monetización                 | Fuera del MVP. El dominio se diseña con `Plan`/límites como política inyectable para no tener que reescribirlo después                                                                  |
| Espectadores, barajas custom | **Dentro**, son baratos si el modelo de dominio está bien                                                                                                                               |
| Barajas incluidas            | Solo **dos** de fábrica: `0.5, 1, 2, 3, 5, 8, 13` y `XS, S, M, L, XL, XXL`. Ambas con carta `?` y carta `☕`. El resto (potencias de 2, horas/días) no aporta nada a un equipo concreto |
| Confeti                      | Dentro. No es adorno: refuerza la señal de consenso                                                                                                                                     |

---

## 2. Alcance por fases

**MVP (v1)** — F1, F3, F5, F6, F8, F9, F10, F11 (permisos básicos), F13, F14, F16
**v1.5** — F2 (async), F4 (barajas custom), F7 (histórico + export), F17
**v2** — Cuentas y dashboard (F15), múltiples facilitadores (F12), planes y límites
**v3** — Integraciones externas (F18/F19), analítica de equipo

---

## 3. Modelo de dominio

El corazón de la aplicación es **una única raíz de agregado: `Game`** (partida). Todas las invariantes de la votación viven dentro de ella.

### 3.1 Agregado `Game`

```
Game (AR)
├── GameId            (VO — UUID)
├── GameName          (VO)
├── Deck              (VO — colección de Card)
├── GameSettings      (VO — autoReveal, countdownSeconds, showAverage,
│                           whoCanReveal, timerDefault, allowAsync)
├── Participants      (colección de Participant)
│   └── Participant
│       ├── ParticipantId (VO)
│       ├── DisplayName   (VO)
│       └── ParticipantRole (VOTER | SPECTATOR)
├── Issues            (colección ordenada de Issue)
│   └── Issue
│       ├── IssueId, Title, Description?, ExternalUrl?
│       ├── IssueStatus (PENDING | VOTING | ESTIMATED | SKIPPED)
│       └── FinalEstimate?  (VO CardValue)
└── VotingRounds      (colección de Round)
    └── Round
        ├── RoundId, IssueId, RoundNumber
        ├── RoundStatus (OPEN | REVEALED | CLOSED)
        ├── Votes: Map<ParticipantId, CardValue>
        ├── revealedAt?
        └── RoundResult? (VO — distribución, media, acuerdo, más votada)
```

### 3.2 Value Objects clave

- **`CardValue`** — jerarquía o VO con `raw: string`, `numericValue: number | null`, `isSpecial: boolean`. `?` y `☕` son especiales: no entran en media ni acuerdo.
- **`Deck`** — garantiza ≥2 cartas, sin duplicados, y expone `contains(CardValue)`. Solo dos factorías de sistema: `Deck.fibonacci()` → `0.5, 1, 2, 3, 5, 8, 13, ?, ☕` y `Deck.tshirt()` → `XS, S, M, L, XL, XXL, ?, ☕`.
- **`RoundResult`** — se **calcula**, no se almacena como verdad: `{ distribution, average, agreementPercentage, mostVoted, isUnanimous }`.

### 3.3 Invariantes de negocio (esto es lo que hay que testear)

1. Un voto solo se acepta si la carta pertenece a la baraja de la partida.
2. Un `SPECTATOR` nunca puede votar.
3. No se puede votar en una ronda `REVEALED` o `CLOSED`.
4. Un participante tiene **como máximo un voto** por ronda; revotar sustituye (permitido hasta el reveal).
5. Solo una ronda `OPEN` por partida a la vez.
6. Revelar exige permiso según `whoCanReveal` (FACILITATOR_ONLY | ANYONE | NAMED_LIST).
7. **Los votos de otros no se exponen hasta el reveal.** Antes solo se emite `hasVoted: boolean` por participante. Esta es una invariante de _dominio y de serialización_, no solo de UI: si el WebSocket manda el valor, cualquiera lo lee en devtools.
8. `autoReveal` dispara el reveal cuando todos los `VOTER` presentes han votado.
9. La media ignora cartas especiales; si no hay ninguna numérica, `average = null`.
10. Cerrar una issue como `ESTIMATED` requiere una ronda revelada y un `FinalEstimate` elegido.

### 3.4 Eventos de dominio

`GameCreated`, `ParticipantJoined`, `ParticipantLeft`, `ParticipantRoleChanged`, `IssueAdded`, `IssueRemoved`, `VotingRoundStarted`, `VoteCast`, `VoteRetracted`, `RoundRevealed`, `IssueEstimated`, `TimerStarted`, `TimerStopped`, `FacilitatorTransferred`.

Los eventos son el **contrato con el mundo real-time**: cada uno se traduce a un mensaje de broadcast. Nada de emitir por WebSocket desde el caso de uso a mano.

---

## 4. Arquitectura hexagonal

### 4.1 Capas y regla de dependencia

```
        ┌──────────────────────────────────────────┐
        │           ADAPTADORES DRIVING            │
        │  REST controller · WS gateway · CLI      │
        └───────────────────┬──────────────────────┘
                            │ (implementan/llaman)
        ┌───────────────────▼──────────────────────┐
        │              APPLICATION                 │
        │  Casos de uso · Puertos (interfaces)     │
        │  DTOs de entrada/salida                  │
        └───────────────────┬──────────────────────┘
                            │
        ┌───────────────────▼──────────────────────┐
        │                DOMAIN                    │
        │  Game, Round, Deck, VOs, eventos,        │
        │  excepciones, servicios de dominio       │
        │  ── CERO imports de framework ──         │
        └──────────────────────────────────────────┘
                            ▲
        ┌───────────────────┴──────────────────────┐
        │           ADAPTADORES DRIVEN             │
        │  SupabaseGameRepository · InMemoryRepo   │
        │  RedisEventBus · WsBroadcaster · Clock   │
        └──────────────────────────────────────────┘
```

Regla dura: **`domain/` no importa nada de `application/`, `infrastructure/` ni de ninguna librería externa** salvo utilidades puras. Se verifica en CI (ver §9.3).

### 4.2 Puertos

**Driving (primarios) — casos de uso**

| Puerto                  | Responsabilidad                                                |
| ----------------------- | -------------------------------------------------------------- |
| `CreateGame`            | Crea partida con baraja y settings, devuelve URL de invitación |
| `JoinGame`              | Registra participante con nombre y rol                         |
| `AddIssues`             | Alta manual, CSV o lista de URLs                               |
| `StartVotingRound`      | Abre ronda sobre una issue                                     |
| `CastVote`              | Registra/actualiza voto                                        |
| `RevealRound`           | Revela, calcula resultado, emite evento                        |
| `SetFinalEstimate`      | Cierra la issue con la estimación acordada                     |
| `ResetRound`            | Nueva ronda sobre la misma issue                               |
| `ControlTimer`          | Start / pause / reset / add time                               |
| `ChangeParticipantRole` | Voter ↔ spectator                                              |
| `TransferFacilitator`   | Traspaso de rol                                                |
| `GetGameState`          | Proyección de lectura filtrada por participante                |
| `ExportGameHistory`     | CSV/JSON                                                       |

**Driven (secundarios)**

| Puerto                | Implementaciones                                                  |
| --------------------- | ----------------------------------------------------------------- |
| `GameRepository`      | `InMemoryGameRepository` (tests), `SupabaseGameRepository` (prod) |
| `EventPublisher`      | `InProcessEventPublisher`, `RedisEventPublisher`                  |
| `RealtimeBroadcaster` | `SocketIoBroadcaster`, `SupabaseRealtimeBroadcaster`              |
| `Clock`               | `SystemClock`, `FixedClock` (tests)                               |
| `IdGenerator`         | `UuidGenerator`, `SequentialIdGenerator` (tests)                  |
| `IssueImporter`       | `CsvIssueImporter`, `UrlListImporter`                             |

### 4.3 Estructura de carpetas propuesta

```
/
├── docker-compose.yml
├── docker-compose.dev.yml
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── game/            # AR, entidades, VOs
│   │       │   ├── events/
│   │       │   └── shared/          # Result, DomainError, base VO
│   │       ├── application/
│   │       │   ├── use-cases/       # un fichero por caso de uso
│   │       │   ├── ports/
│   │       │   │   ├── driving/
│   │       │   │   └── driven/
│   │       │   └── dto/
│   │       ├── infrastructure/
│   │       │   ├── http/            # controllers, schemas, mappers
│   │       │   ├── realtime/        # ws gateway, broadcaster
│   │       │   ├── persistence/
│   │       │   │   ├── supabase/    # repos + mappers persistencia↔dominio
│   │       │   │   └── in-memory/
│   │       │   └── config/          # DI container, env
│   │       └── main.ts              # composition root: lo único que "sabe" todo
│   └── web/
│       ├── Dockerfile
│       └── src/                     # UI (ver §7)
├── packages/
│   └── contracts/                   # tipos compartidos api↔web (eventos, DTOs)
└── docs/
    └── adr/                         # Architecture Decision Records
```

**Nota sobre Clean Code aquí:** la trampa habitual de la hexagonal es acabar con anemia — entidades con getters y setters y toda la lógica en los "servicios". Si `Game` no tiene métodos como `castVote()`, `reveal()`, `canReveal()`, no hay hexagonal, hay tres carpetas. Los casos de uso deben ser finos: cargar agregado → invocar método de dominio → persistir → publicar eventos.

### 4.4 Ejemplo de caso de uso (pseudocódigo agnóstico)

```ts
class CastVoteUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CastVoteCommand): Promise<void> {
    const game = await this.games.findById(GameId.of(cmd.gameId));
    if (!game) throw new GameNotFoundError(cmd.gameId);

    // toda la invariante vive aquí dentro
    game.castVote(ParticipantId.of(cmd.participantId), CardValue.of(cmd.card), this.clock.now());

    await this.games.save(game);
    await this.events.publishAll(game.pullDomainEvents());
  }
}
```

---

## 5. Modelo de datos (PostgreSQL / Supabase)

```sql
create table games (
  id              uuid primary key,
  name            text not null,
  deck            jsonb not null,          -- {type, cards:[...]}
  settings        jsonb not null,
  facilitator_token text not null,          -- secreto para el rol facilitador
  status          text not null default 'ACTIVE',
  created_at      timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table participants (
  id          uuid primary key,
  game_id     uuid not null references games(id) on delete cascade,
  display_name text not null,
  role        text not null,               -- VOTER | SPECTATOR
  is_facilitator boolean not null default false,
  joined_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create table issues (
  id          uuid primary key,
  game_id     uuid not null references games(id) on delete cascade,
  title       text not null,
  description text,
  external_url text,
  position    integer not null,
  status      text not null default 'PENDING',
  final_estimate text,
  unique (game_id, position) deferrable initially deferred
);

create table voting_rounds (
  id           uuid primary key,
  game_id      uuid not null references games(id) on delete cascade,
  issue_id     uuid not null references issues(id) on delete cascade,
  round_number integer not null,
  status       text not null default 'OPEN',
  started_at   timestamptz not null default now(),
  revealed_at  timestamptz,
  unique (issue_id, round_number)
);

create table votes (
  round_id       uuid not null references voting_rounds(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  card_value     text not null,
  cast_at        timestamptz not null default now(),
  primary key (round_id, participant_id)   -- invariante 4 a nivel de BD
);

create unique index one_open_round_per_game
  on voting_rounds (game_id) where status = 'OPEN';   -- invariante 5
```

**Puntos de diseño:**

- `deck` y `settings` como `jsonb`: son VOs inmutables, no se consultan por dentro. Evita 4 tablas de acompañamiento.
- Las invariantes 4 y 5 se refuerzan también en BD. El dominio es la fuente de verdad, la BD es la red de seguridad ante concurrencia.
- **Nada de RLS como sustituto del dominio.** Si usamos Supabase, el cliente web **no** habla con Postgres directamente: habla con nuestra API. Supabase se usa como Postgres gestionado (+ opcionalmente Realtime). Si en algún momento se abre el acceso directo desde el navegador, hay que activar RLS estricta o la invariante 7 se rompe (cualquiera podría leer `votes` antes del reveal).
- Retención: job que borra partidas con `last_activity_at` > N meses (RGPD, §8.4).

---

## 6. API y contrato de tiempo real

### 6.1 REST (operaciones no urgentes)

```
POST   /api/games                        → crea partida
GET    /api/games/:id                    → estado (proyección filtrada)
POST   /api/games/:id/participants       → unirse
PATCH  /api/games/:id/participants/:pid  → cambiar rol
POST   /api/games/:id/issues             → añadir issues (manual/CSV/urls)
PATCH  /api/games/:id/issues/:iid        → editar/reordenar
DELETE /api/games/:id/issues/:iid
GET    /api/games/:id/export             → CSV/JSON del histórico
```

### 6.2 WebSocket (la partida en vivo)

**Cliente → servidor**
`join`, `vote`, `retract_vote`, `start_round`, `reveal`, `reset_round`, `set_estimate`, `timer_control`, `ping`

**Servidor → cliente**
`state_sync` (al conectar/reconectar), `participant_joined`, `participant_left`, `participant_voted` _(solo `{participantId, hasVoted:true}`)_, `round_started`, `round_revealed` _(aquí y solo aquí van los valores)_, `round_reset`, `issue_estimated`, `issue_list_changed`, `timer_tick`, `error`.

**Reglas de diseño del canal:**

- Un **room por `gameId`**.
- Cada mensaje lleva `version` incremental de la partida; el cliente que detecte un salto pide `state_sync`. Resuelve reconexiones sin lógica frágil.
- El servidor **filtra la proyección por participante**: la serialización del estado toma `viewerId` como parámetro. Antes del reveal, `votes` viaja como lista de ids, sin valores.
- Idempotencia: `vote` con el mismo valor no genera evento nuevo.
- Timer: el servidor emite `timer_started(endsAt)` y el cliente cuenta solo; nada de un tick por segundo por WebSocket para 20 personas.

---

## 7. Frontend

- SPA que consume REST + WS, con estado de partida en un store único alimentado por los eventos del servidor (reducer sobre el mismo contrato de `packages/contracts`).
- Vistas: crear partida · sala de espera · mesa de votación · panel de resultados · sidebar de issues · ajustes · QR de invitación.
- Requisitos de UX del original que merecen respetarse: giro simultáneo de cartas animado, resultado legible de un vistazo (distribución + media + % acuerdo), confeti en unanimidad, y **responsive real** (mucha gente vota desde el móvil en la daily).
- Accesibilidad: la mesa tiene que ser navegable por teclado y los estados de voto no pueden depender solo del color.

---

## 8. Requisitos no funcionales

### 8.1 Rendimiento

- Latencia p95 de propagación de evento < 200 ms en la misma región.
- Objetivo de carga MVP: 200 partidas concurrentes × 12 participantes.

### 8.2 Escalado

Con una sola instancia, el broadcast en memoria basta. En cuanto haya ≥2 instancias hace falta **adaptador Redis pub/sub** (o Supabase Realtime) detrás de `RealtimeBroadcaster` — el resto del código no se entera. Sticky sessions en el balanceador si se usa WS nativo.

### 8.3 Fiabilidad

- Reconexión automática con backoff y `state_sync`.
- Estado persistido tras cada comando: si cae el contenedor, la partida sobrevive.
- Health checks `/health` (liveness) y `/ready` (readiness, comprueba BD).

### 8.4 Privacidad / RGPD

Se guardan nombres de visualización elegidos libremente; conviene no exigir email al jugador (como hace el original). Aviso de retención, borrado de partidas inactivas, y política de cookies mínima. Alojar en UE simplifica bastante esto.

### 8.5 Seguridad

- Rate limiting por IP y por participante en `vote` y `join`.
- `gameId` en URL como UUIDv4 (no adivinable) + token de facilitador separado.
- Validación de esquema en el borde (zod/JSON Schema) — el dominio nunca recibe `any`.
- Sanitización de nombres de participante e issues (XSS).

---

## 9. Docker y calidad

### 9.1 `docker-compose.yml` (desarrollo)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: development
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/planningpoker
      - REDIS_URL=redis://redis:6379
    ports: ['3000:3000']
    depends_on:
      db: { condition: service_healthy }
    volumes:
      - ./apps/api/src:/app/apps/api/src

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    ports: ['5173:5173']

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: planningpoker
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

Producción: mismo Dockerfile multi-stage con `target: production`, imagen final `distroless`/`alpine`, usuario no root, sin devDependencies, healthcheck declarado.

### 9.2 Testing (pirámide que la hexagonal hace barata)

- **Unitarios de dominio** — invariantes 1-10, sin mocks, sin BD. Es donde debe estar el grueso.
- **De caso de uso** — con `InMemoryGameRepository` y `FixedClock`. Rápidos y deterministas.
- **De contrato del repositorio** — la misma suite corre contra in-memory y contra Supabase.
- **E2E** — un flujo: crear → unirse 3 → votar → revelar → estimar, con dos clientes WS reales.

### 9.3 Barreras arquitectónicas en CI

Test automático que falle si `domain/` importa de `application/`, `infrastructure/` o de librerías de framework (dependency-cruiser en TS, ArchUnit en Java). Sin esto, la hexagonal se erosiona en tres sprints.

---

## 10. Dónde alojarlo

Requisitos que condicionan la elección: **conexiones WebSocket largas** (descarta serverless puro tipo Vercel Functions para la API), **contenedor Docker**, **Postgres**, y preferiblemente **región UE**.

| Opción                        | Modelo                                   | Coste orientativo                            | A favor                                                                                                                                  | En contra                                                                          |
| ----------------------------- | ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Hetzner + Coolify/Dokploy** | VPS propio, docker-compose casi tal cual | ~5-15 €/mes, plano                           | El más barato con diferencia; datacenters en Alemania/Finlandia; sin límites de egress prácticos; despliegue git-push con SSL automático | Tú eres el sysadmin: backups, actualizaciones, monitorización                      |
| **Railway**                   | PaaS por consumo                         | ~10-15 $/mes app+BD                          | Mejor DX de los PaaS; WS sin fricción; despliegue en minutos                                                                             | Sin free tier; la factura sube con el uso; egress caro                             |
| **Render**                    | PaaS por instancia                       | ~7 $/servicio, +25 $/mes workspace de equipo | Factura predecible; tiene tier gratis (duerme a los 15 min de inactividad)                                                               | Cada servicio y cada BD es una línea de factura; egress incluido recortado en 2026 |
| **Fly.io**                    | Máquinas por segundo                     | ~2-10 $/mes                                  | Docker nativo, multi-región, sin cuota base, buena latencia                                                                              | Sin free tier; requiere Dockerfile y más manejo de infra                           |
| **Google Cloud Run**          | Contenedor gestionado                    | Escala a cero                                | Escala a cero, región Madrid disponible                                                                                                  | WS con timeout máximo por request; escala a cero castiga las partidas en vivo      |
| **Supabase**                  | BD/Auth/Realtime gestionados             | Free tier real, luego ~25 $/mes              | Postgres gestionado + Realtime + Auth listos; región UE                                                                                  | Free tier pausa proyectos inactivos; ojo con acoplarse a su SDK en el dominio      |

**Recomendación:**

- **Aprendizaje / primeras versiones:** Hetzner CX22/CAX21 (~5 €/mes) con **Dokploy** o **Coolify** + el `docker-compose` del §9.1, y Postgres en el mismo servidor. Cero magia de plataforma, y es donde más se aprende de despliegue.
- **Si prefieres no administrar servidor:** **Railway** para la API (WS sin configuración) + **Supabase** para Postgres. Frontend estático en Vercel/Cloudflare Pages si se separa.
- Los precios de estos PaaS cambian con frecuencia (Render rehizo su modelo en abril de 2026); conviene comprobar la página de precios antes de comprometerse.

---

## 11. Riesgos y decisiones abiertas

| Riesgo                               | Mitigación                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtración de votos antes del reveal | Proyección filtrada por `viewerId` + test E2E que inspecciona el payload crudo del WS                                                         |
| Dominio anémico                      | Revisión: cada caso de uso ≤ 20 líneas; si crece, la lógica se ha escapado del agregado                                                       |
| Acoplamiento a Supabase              | El SDK solo aparece en `infrastructure/persistence/supabase`. Suite de contrato del repositorio                                               |
| Escalado a >1 instancia              | `RealtimeBroadcaster` como puerto desde el día 1, aunque el MVP use memoria                                                                   |
| Sobreingeniería                      | La hexagonal completa para un CRUD sería absurda; aquí se justifica por las 10 invariantes y los múltiples adaptadores de entrada (REST + WS) |

---

## 12. Decisiones tomadas

| Punto         | Decisión                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ |
| Stack         | TypeScript / Node                                                                          |
| Objetivo      | Herramienta interna para el equipo                                                         |
| Alcance MVP   | Votación en vivo + barajas personalizadas. Async, histórico e importación quedan para v1.5 |
| Tiempo real   | Socket.IO propio                                                                           |
| Autenticación | Anónima por link, sin cuentas                                                              |
| Persistencia  | Postgres en el propio `docker-compose` (Supabase descartado por encaje, no por calidad)    |
| Despliegue    | VPS Hetzner + Dokploy, una instancia                                                       |

El detalle de cada una, junto con el plan de construcción por bloques, está en **`02-decisiones-y-plan.md`**.
