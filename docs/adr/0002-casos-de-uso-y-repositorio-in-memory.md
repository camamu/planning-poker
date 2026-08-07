# 0002 — Casos de uso y repositorio in-memory (bloque 3)

## Contexto

El bloque 3 envuelve el agregado `Game` del bloque 2 en casos de uso finos (`application/use-cases/`) y los hace testeables sin infraestructura mediante un `GameRepository` in-memory. El deliverable de `docs/02-decisiones-y-plan.md` §5 dice literalmente "crear partida, unirse, abrir ronda, votar, revelar", pero varios detalles de cableado no estaban decididos.

## Decisiones

- **Se añade `AddIssue` aunque no está listado explícitamente en el bloque.** "Abrir ronda" (`StartVotingRound`) exige una `Issue` existente en la partida, y no hay ningún otro caso de uso que dé de alta issues en este bloque (`AddIssues` plural, con CSV/URLs, es F16/F17 y queda fuera de v1). Sin `AddIssue` el flujo "crear → unirse → abrir ronda → votar → revelar" no se puede ejercitar de punta a punta a través de la capa de aplicación. Es el mínimo indispensable, no una funcionalidad añadida por iniciativa propia.
- **`CreateGame` devuelve `{ gameId, facilitatorId }`, no solo el id de partida.** `Game.create` da de alta al facilitador dentro del propio agregado (bloque 2); si el caso de uso no expone ese id, no hay forma de que el llamador (la futura capa HTTP) sepa quién es el facilitador para poder votar o revelar después. Es un requisito funcional del propio caso de uso, no un adelanto del bloque 5.
- **`IdGenerator` es `{ generate(): string }`, sin variantes tipadas por entidad.** Cada caso de uso combina el string con el VO de identidad correspondiente (`GameId.of(...)`, `ParticipantId.of(...)`, etc.). Mantiene el puerto de una línea y deja la responsabilidad de tipar en el punto de uso, igual que hace `docs/01-especificacion.md` §4.2 al listar `UuidGenerator`/`SequentialIdGenerator` como implementaciones intercambiables.
- **`Clock` no se redefine en `application/`.** El tipo ya vive en `domain/shared/Clock.ts` desde el bloque 2 (`import type`); los casos de uso lo consumen tal cual. Añadir un segundo `Clock` en `application/ports/` habría sido duplicar un tipo sin comportamiento propio.
- **`GameNotFoundError` no es una `DomainError`.** Es un fallo de "no se encontró el agregado en el repositorio", una preocupación de orquestación de `application/`, no una invariante de negocio de `Game`. Vive en `application/use-cases/GameNotFoundError.ts` como `Error` normal, y un helper compartido `loadGame(games, id)` evita repetir el `if (!game) throw ...` en los cinco casos de uso que cargan una partida existente.
- **Sin `EventPublisher` real todavía; los tests usan un `RecordingEventPublisher` propio.** El puerto `EventPublisher` (`publishAll`) sí se crea en este bloque porque la regla permanente 3 exige que todo caso de uso siga "cargar → invocar → persistir → publicar". Pero una implementación real (`InProcessEventPublisher`) no tiene consumidor hasta que exista `RealtimeBroadcaster` (bloque 5), así que no se construye todavía — igual que `Clock` quedó como tipo huérfano de infraestructura en el bloque 2 hasta que aplicación lo usara.
- **No se crean `DeckRepository` ni `RealtimeBroadcaster`.** Las barajas siguen siendo solo `Deck.fibonacci()`/`Deck.tshirt()` (barajas custom = bloque 7); el broadcast en tiempo real es bloque 5. Añadirlos ahora sería diseñar para un caso de uso que este bloque no ejercita.
- **`main.ts` no se toca.** Cablear `CreateGame` etc. con implementaciones concretas (Postgres, Socket.IO) es trabajo del bloque 5 (composition root real); este bloque demuestra que los casos de uso funcionan con el repositorio in-memory desde los tests, no desde la app arrancada.

## Fuera de alcance de este bloque (deliberado)

- `SetFinalEstimate`, `ResetRound`, `ControlTimer`, `ChangeParticipantRole`, `TransferFacilitator`, `GetGameState`, `ExportGameHistory` — puertos driving listados en `docs/01-especificacion.md` §4.2 pero no exigidos por el deliverable del bloque 3.
- `InProcessEventPublisher`/`RedisEventPublisher`, `UuidGenerator`, `SystemClock` — implementaciones "reales" de los puertos; se cablean cuando exista un composition root que las necesite (bloque 5).
- `DeckRepository`, `RealtimeBroadcaster` — puertos de bloques 7 y 5 respectivamente.

## Consecuencias

- Los seis casos de uso (`CreateGame`, `JoinGame`, `AddIssue`, `StartVotingRound`, `CastVote`, `RevealRound`) son cargar→invocar→persistir→publicar puros: ninguno tiene un `if` de decisión de negocio, toda esa lógica sigue en `Game`.
- `pnpm --filter @pp/api test:unit` cubre los casos de uso con `InMemoryGameRepository` + `FixedClock` + `SequentialIdGenerator` + `RecordingEventPublisher`, sin BD ni HTTP.
- El bloque 4 (persistencia Postgres) solo necesita añadir un segundo adaptador de `GameRepository` con mappers explícitos; los casos de uso no deberían cambiar.
