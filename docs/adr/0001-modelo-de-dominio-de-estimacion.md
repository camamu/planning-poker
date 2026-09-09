# 0001 — Modelo de dominio de estimación (bloque 2)

## Contexto

El bloque 2 implementa el agregado `Game` y sus objetos de valor (`CardValue`, `Deck`, `RoundResult`) tal y como los describe `docs/01-especificacion.md` §3, sin BD ni HTTP. La especificación fija la forma del agregado y las 10 invariantes de negocio, pero deja abiertos varios detalles de implementación que hay que decidir para que el código compile y sea testeable.

## Decisiones

- **Errores tipados, no `Result`.** Cada invariante violada lanza una subclase de `DomainError` (`SpectatorCannotVoteError`, `CardNotInDeckError`, etc.), como en el pseudocódigo de `docs/01-especificacion.md` §4.4. Los casos de uso (bloque 3) decidirán si las capturan o las dejan propagar hasta el borde HTTP.
- **El tiempo entra como `Date`, no como `Clock` inyectado en el dominio.** Cada método de `Game` que muta estado recibe `now: Date` como parámetro; el dominio nunca llama a `Date.now()`. `domain/shared/Clock.ts` define el tipo del puerto (documentando el mecanismo) pero su único consumidor será la capa de aplicación en el bloque 3 — de ahí que `pnpm arch` lo marque como módulo huérfano; es esperado hasta entonces.
- **Eventos como unión discriminada, no clases.** `GameEvent` (en `domain/game/events/GameEvent.ts`) es un type `DomainEvent & { type: '...', ... }` en vez de una clase por evento. Con `@typescript-eslint/no-explicit-any` y sin enums (regla del proyecto), una unión de literales da el mismo chequeo exhaustivo con menos ficheros.
- **`Game.castVote` separa el reveal automático del manual.** El pseudocódigo de referencia llama a `this.reveal(participantId, now)` dentro de `castVote` para el `autoReveal`, pero eso reutilizaría la comprobación de permisos (`canReveal`) con el último votante, que puede no tener permiso para revelar bajo `FACILITATOR_ONLY` o `NAMED_LIST` (invariante 6 rompería la invariante 8). `Game` expone un `performReveal` privado que hace el trabajo real; `reveal()` (manual) comprueba `canReveal()` antes de llamarlo, `castVote()` lo llama directamente cuando `autoReveal` se dispara.
- **`RoundResult`: semántica de `mostVoted`/`agreementPercentage` no especificada, se fija aquí.** `mostVoted` es la carta con más votos (empate → la primera en aparecer); `agreementPercentage` es el `%` de votos que coinciden con `mostVoted` sobre el total de votos emitidos; `isUnanimous` exige al menos un voto y 100% de acuerdo. La media (`average`) sigue la invariante 9 al pie de la letra: ignora cartas especiales y es `null` si no hay ninguna numérica.
- **Invariante 7 a nivel de API del dominio, no solo de serialización.** `Round.revealedVotes()` y `Round.revealedResult()` lanzan si la ronda no está revelada; antes del reveal solo `hasVoted(participantId): boolean` es accesible. Esto hace estructuralmente imposible que una futura proyección lea un valor de voto ajeno antes del reveal por error — el dato no existe como público hasta entonces.
- **`Game.currentRound()` y `Game.findIssue()` son públicos**, no solo state interno. Los necesitará la proyección de lectura filtrada por `viewerId` (`toGameView`, bloque 5) y ya los usan los tests de este bloque para verificar invariantes sin depender únicamente de los eventos emitidos.

## Fuera de alcance de este bloque (deliberado)

- `Team`/`TeamId` y barajas personalizadas (`Deck.custom`) — bloque 7.
- Temporizador de discusión y ajustes de settings relacionados (`countdownSeconds`, `timerDefault`) — bloque 8.
- `showAverage`, `allowAsync` en `GameSettings` — no afectan ninguna invariante de dominio, se añadirán cuando la vista o la votación asíncrona los necesiten.
- `IssueStatus.SKIPPED`, `removeIssue`, `ParticipantLeft`, `FacilitatorTransferred` — no los ejercita ninguna de las 10 invariantes; se añaden cuando el caso de uso correspondiente los necesite, para no cargar el agregado con comportamiento sin test.
- `IdGenerator` no existe todavía: los tests de dominio construyen los VOs de identidad a partir de strings literales; en el bloque 3 los casos de uso los generarán vía el puerto driven correspondiente.

## Consecuencias

- El agregado es completamente testeable sin mocks ni infraestructura (`pnpm --filter @pp/api test:unit`), con cobertura de `src/domain` en 100% líneas/funciones, 97.7% ramas (umbral del proyecto: 90%).
- El bloque 3 (casos de uso + repo in-memory) no debería necesitar tocar `domain/`: `CreateGame`, `JoinGame`, `CastVote`, `RevealRound` mapean 1:1 a `Game.create`, `Game.addParticipant`, `Game.castVote`, `Game.reveal`.
