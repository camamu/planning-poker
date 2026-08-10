# 0004 — HTTP + WebSocket (bloque 5)

## Contexto

El bloque 5 cablea los seis casos de uso del bloque 3 (`CreateGame`, `JoinGame`, `AddIssue`,
`StartVotingRound`, `CastVote`, `RevealRound`) detrás de Fastify y Socket.IO, y añade el séptimo
(`GetGameState`) que el bloque 3 dejó fuera deliberadamente. El deliverable de
`docs/02-decisiones-y-plan.md` §5 es literal: "Fastify, Socket.IO, proyección filtrada, `state_sync`
con `version`". El problema no resuelto por bloques anteriores: `EventPublisher` (puerto, bloque 3)
no tenía implementación real, y ningún caso de uso conoce el concepto de "viewer" que exige la
invariante 7 al serializar hacia fuera.

## Decisiones

- **`packages/contracts` gana `views.ts`/`events.ts`/`commands.ts`**, tal y como anticipaba
  `docs/02-decisiones-y-plan.md` §3. `commands.ts` valida con zod los cuatro cuerpos REST y los
  cuatro comandos WS que este bloque ejercita; `events.ts` tipa el union discriminado de mensajes
  servidor→cliente (`ServerEvent`, con `version` en todos); `views.ts` tipa el DTO de proyección
  (`GameView`). El placeholder `CONTRACTS_PACKAGE` desaparece: no lo usaba nadie y no es lo que
  este paquete existe para dar.
- **`application/read-models/toGameView.ts` es el único punto por el que un voto sale del servidor
  hacia un participante concreto** (invariante 7). Sigue al pie de la letra el pseudocódigo de
  `docs/02-decisiones-y-plan.md` §4.3: antes del reveal, `votes` solo lleva en claro el propio voto
  de `viewerId`; el resto aparece como `{ hasVoted: true, card: null }`. Para poder leer los votos
  de una ronda abierta necesita `Round.allVotesRaw()` (bloque 4, hasta ahora "solo para el mapper
  de persistencia"); el comentario de ese método se amplía para documentar este segundo llamador
  legítimo — ambos son código interno de confianza que enmascara antes de que el dato cruce al
  exterior, que es justo lo que la invariante 7 exige proteger.
- **`GetGameState` (nuevo caso de uso) es `loadGame` + `toGameView`, nada más.** Es el puerto
  driving que `docs/01-especificacion.md` §4.2 lista y que el bloque 3 dejó fuera a propósito.
- **`RealtimeBroadcaster` (puerto nuevo) solo tiene `broadcastToGame(gameId, event)`.** No hay
  `sendToParticipant`: `state_sync` es una respuesta directa del gateway WS a quien pregunta (no
  pasa por este puerto ni por `EventPublisher`), y todos los demás eventos salientes son seguros
  para toda la room sin filtrar por viewer — incluido `round_revealed`, que solo se emite cuando la
  ronda ya es pública para todos. Filtrar por viewer solo hacía falta para `state_sync`/`GetGameState`.
- **`WsEventPublisher` (la implementación real de `EventPublisher`) traduce `GameEvent` → `ServerEvent`
  releyendo la partida por `GameRepository` cuando hace falta**, en vez de que el puerto `EventPublisher`
  reciba el agregado además de los eventos. `RoundRevealed` no lleva votos ni resultado en el propio
  evento de dominio; como `save()` siempre precede a `publishAll()` en los casos de uso (regla
  permanente 3), releer ve el estado ya persistido. Cambiar la firma del puerto para que reciba el
  `Game` habría sido más directo, pero el pseudocódigo de referencia de
  `docs/01-especificacion.md` §4.4 fija `publishAll(events)` sin agregado, y tocar esa firma habría
  obligado a retocar los seis casos de uso del bloque 3 sin necesidad real.
- **`GameVersionTracker` es un contador en memoria por partida, en `infrastructure/realtime/`, no en
  el dominio.** El `version` de `docs/01-especificacion.md` §6.2 es un detalle de entrega en tiempo
  real (para que el cliente detecte huecos y pida `state_sync`), no un hecho de negocio; con una sola
  instancia (§8.2) no hace falta más. Solo se incrementa cuando de verdad se emite un `ServerEvent`
  (p. ej. `GameCreated` no genera ninguno — nadie está aún en la room de una partida recién creada).
- **REST cubre lo "no urgente" que ya tiene caso de uso** (`POST /api/games`, `GET /api/games/:id`,
  `POST /api/games/:id/participants`, `POST /api/games/:id/issues`); **WS cubre lo que corre en vivo**
  (`join`, `vote`, `start_round`, `reveal`), calcando la separación de `docs/01-especificacion.md`
  §6. `retract_vote`, `reset_round`, `set_estimate`, `timer_control` no se cablean: no existe caso de
  uso para ellos (`RetractVote`, `SetFinalEstimate`, etc. quedaron fuera del bloque 3 a propósito, ver
  ADR 0002) y añadirlos ahora sería inventar aplicación nueva en un bloque que es "HTTP + WebSocket",
  no "casos de uso que faltaban".
- **Bug de regex en `.dependency-cruiser.cjs` corregido.** La regla `solo-main-cablea` tenía
  `'...Repository|Broadcaster'` sin agrupar: por precedencia de `|`, el segundo operando
  (`Broadcaster`) no llevaba el anclaje `^apps/api/src/infrastructure/...`, así que cualquier import
  de un módulo cuyo _path_ contuviera la subcadena "Broadcaster" — incluido el puerto
  `application/ports/RealtimeBroadcaster.ts`, que no es una implementación concreta — habría violado
  la regla desde cualquier fichero. Nadie lo había notado porque hasta este bloque ningún código
  importaba nada con "Broadcaster" en el nombre. Se corrige a
  `'...(Repository|Broadcaster)'`, que es evidentemente la intención original de la regla.
- **`apps/api/tsconfig.test.json` amplía `rootDir` a la raíz del repo (`../..`).** Es el primer
  bloque en el que código de `apps/api/src` importa `@pp/contracts` de verdad; `tsc` exige que todos
  los ficheros del programa (incluido `packages/contracts/src/*.ts`, resuelto vía el `paths` mapping
  que ya existía desde el bloque 1) queden bajo `rootDir` en cuanto `declaration: true` está activo,
  aunque la propia comprobación sea `--noEmit`. Sin este cambio, `pnpm typecheck` no compila. El
  `tsconfig.json` base (usado por `build`) no se toca: `pnpm build` no se ejerce todavía en ningún
  pipeline y queda fuera de alcance de este bloque.
- **`main.ts` gana `@fastify/cors`, `SystemClock`, `UuidGenerator`, `PostgresGameRepository`,
  `SocketIoBroadcaster` y `WsEventPublisher` de verdad.** Es la primera vez que el composition root
  cablea implementaciones concretas más allá del `Pool`/health del bloque 1; sigue siendo el único
  fichero que lo hace (`solo-main-cablea` verde). `CORS_ORIGIN`, ya validado por `env.ts` desde el
  bloque 1 pero sin consumidor hasta ahora, pasa a usarse tanto en el plugin CORS de Fastify como en
  la config de Socket.IO.
- **Los tests e2e usan `InMemoryGameRepository`, no Postgres real.** `docs/apps/api` separa
  `test:contract` (misma suite contra ambos adaptadores, con BD real) de `test:e2e` ("stack real, dos
  clientes WS"); "stack real" se interpreta como HTTP+WS reales, no persistencia real — eso ya lo
  cubre `test:contract`. Mantiene `test:e2e` rápido y sin requisitos de infraestructura, y evita
  duplicar cobertura. El arnés de test (`tests/e2e/support/testServer.ts`) reconstruye el mismo
  cableado que `main.ts` pero inyectando el repositorio in-memory; como `depcruise` solo analiza
  `apps/api/src` (no `tests/`), construir ahí instancias concretas de `SocketIoBroadcaster` e
  `InMemoryGameRepository` no viola `solo-main-cablea` — ese arnés no es "el resto del sistema", es
  el equivalente de test de `main.ts`.
- **El test e2e obligatorio de la invariante 7** (`tests/e2e/live-game.e2e.test.ts`) conecta dos
  sockets reales, hace votar a un participante y comprueba que el payload crudo que recibe el otro
  participante en `participant_voted` no contiene la clave `card` en absoluto (ni por tanto el valor
  votado), y que solo tras `reveal` ambos clientes ven las cartas de todos.

## Fuera de alcance de este bloque (deliberado)

- `RetractVote`, `SetFinalEstimate`, `ResetRound`, `ControlTimer`, `ChangeParticipantRole`,
  `TransferFacilitator`, `ExportGameHistory` — casos de uso sin construir; sus rutas HTTP/WS
  correspondientes tampoco existen. Quedan para los bloques a los que pertenecen (7, 8) o para
  cuando alguien los pida explícitamente.
- Rate limiting, sanitización de nombres/issues contra XSS, cookie de sesión de participante —
  `docs/01-especificacion.md` §8.5, no exigidos por el deliverable literal de este bloque.
- Reconexión con backoff en el cliente — es trabajo del bloque 6 (frontend), que es quien tiene
  cliente que reconectar.
- `pnpm build` de `@pp/api` con el `rootDir` cruzando paquetes — no se ejercita en ningún pipeline
  todavía; si algún bloque futuro lo necesita, ahí se revisita.

## Consecuencias

- `pnpm --filter @pp/api test:unit` pasa a incluir `GetGameState` (proyección filtrada) junto a los
  seis casos de uso del bloque 3.
- `pnpm --filter @pp/api test:e2e` ejercita de punta a punta: crear partida → unirse → añadir issue →
  abrir ronda → votar (dos participantes) → revelar, sobre HTTP real + dos sockets WS reales, y deja
  fijada en un test la invariante 7 a nivel de payload de red, no solo de dominio.
- `pnpm verify` (lint + typecheck + arch + test) pasa completo, incluida la suite de contrato contra
  un Postgres real.
- El bloque 6 (frontend) puede consumir `@pp/contracts` (`views.ts`/`events.ts`/`commands.ts`) tal
  cual desde `apps/web/src/shared/` sin inventar un contrato nuevo.
