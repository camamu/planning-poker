# 0005 — Extensión de alcance del bloque 6: handoff de diseño completo (bloque 6)

## Contexto

El handoff de Claude Design (`docs/06-handoff-diseno.md`, `docs/design/`) cubre bastante más que el entregable mínimo original del bloque 6 en `docs/02-decisiones-y-plan.md` §5 ("crear/unirse/votar/revelar, giro, resultados, confeti"). Concretamente adelanta F5 (cuenta atrás y auto-reveal) y F8 (temporizador de discusión) — ambos en alcance de MVP según `docs/01-especificacion.md` §2, pero secuenciados para el bloque 8 por ADR 0001 — y añade elementos que no están en la especificación funcional en absoluto (F1-F19): rotación de "dealer", lanzar/reaccionar con emoji y sonido sintetizado, e insignias de plumas/capa por dispersión de voto.

Se decidió, con el dueño del repositorio, construir el handoff completo en este bloque, ampliando `application/`/`infrastructure/` donde haga falta, en vez de recortar al entregable mínimo original. Este ADR documenta esa decisión y las consecuencias sobre la secuencia de bloques ya planificada.

## Decisiones

- **`GameSettings` pasa de 3 a 7 campos.** Se añaden `allowVoteChange`, `celebrate`, `throwEmojis`, `countdownSeconds`, `revealOnTimeout`, y `whoCanReveal` gana el valor `'DEALER'`. `celebrate` no impone ninguna invariante (el confeti es una decisión de render sobre `isUnanimous`, ya expuesto); `throwEmojis` se comprueba en la gateway antes de reenviar un emoji, pero no es una invariante de dominio.
- **El "dealer" es una función calculada, no un hecho persistido.** `Game.currentDealer()` deriva el dealer del índice de la issue actual y del orden de entrada de los `VOTER` — no hay `FacilitatorTransferred` ni tabla de rotación. Esto exige una posición estable de entrada (`Participant.joinOrder`, columna `participants.position`, mismo patrón que ya usan `issues.position`/`rounds.position`), porque ni un `Map` ni una fila de Postgres garantizan orden sin una columna explícita.
- **F5 (cuenta atrás) se modela sin `TimerStarted`/`TimerStopped`.** `Round` guarda `timerDeadline: Date | null`, calculado por el servidor al abrir la ronda a partir de `now` (nunca `Date.now()` en el dominio). El reveal por timeout es disparado por el cliente y validado por el servidor (`Game.revealOnTimeout`, idempotente, sin comprobar permisos — mismo precedente que el auto-reveal de `castVote`), no por un scheduler del lado servidor. Un `TimerScheduler` real no sobreviviría a un reinicio del proceso de todos modos (instancia única, sin Redis, ver `docs/02-decisiones-y-plan.md` §1) y añade una pieza de infraestructura entera para el mismo resultado práctico.
- **F8 (temporizador de discusión) es puramente efímero.** No es un campo de `Round`, no genera evento de dominio ni fila en BD: vive en un tracker en memoria (`DiscussionTimerTracker`, mismo espíritu que `GameVersionTracker`) dentro de `infrastructure/realtime/`, con su propio evento de socket fuera de `ServerEvent`. Se pierde en un reinicio del servidor — aceptado explícitamente, igual que ya se acepta para `GameVersionTracker`.
- **Lanzar/reaccionar con emoji vive fuera del agregado por completo.** No hay evento de dominio, no hay persistencia, no pasa por `EventPublisher`/`WsEventPublisher`. Es exactamente el mismo caso que `join` en `SocketIoGateway.ts`, que ya bypassa `WsEventPublisher` por ser "una respuesta directa, no un hecho de negocio" — se aplica la misma regla que el código ya establecía, no una nueva.
- **`allowVoteChange` sí es una invariante real.** Hasta ahora `castVote` permitía recastear sin condición; con el ajuste desactivado, votar dos veces con cartas distintas lanza `VoteChangeNotAllowedError` (repetir la misma carta sigue siendo un no-op, vía `hasSameVote`, independientemente del ajuste).
- **`Game.updateSettings` se restringe al facilitador.** No hay ninguna otra acción de "tocar la configuración compartida" en el dominio que sirva de precedente distinto; se usa el mismo criterio que ya existe para `FACILITATOR_ONLY` en `canReveal`.
- **El editor de barajas (pantalla 5 del handoff) se construye solo en el frontend, de solo lectura.** Persistir barajas personalizadas exige `Team`/`Deck.custom`, explícitamente fuera de alcance del bloque 2 (ADR 0001) y reservado al bloque 7. La pantalla se construye con las dos barajas de sistema, asas de arrastre inertes y "+ Baraja nueva" deshabilitado, para completar visualmente el handoff sin inventar persistencia que el bloque 7 tendría que rehacer.

## Fuera de alcance de este bloque (deliberado)

- `Deck.custom` / `Team` con persistencia real — bloque 7, sin cambios respecto a ADR 0001.
- Un `TimerScheduler` del lado servidor que sobreviva a un reinicio — el diseño client-triggered/server-validated de F5 es una decisión consciente, no un recorte por omisión; si en el futuro hace falta resistencia a reinicios, es una extensión localizada (persistir el estado del timer en `rounds`), no un rediseño.
- La UI de `NAMED_LIST` — el dominio y el contrato lo siguen soportando (no se retira nada), pero ninguna pantalla del handoff lo expone; el segmentado de "¿Quién puede revelar?" solo cubre `ANYONE`/`DEALER`/`FACILITATOR_ONLY`.
- El dealer se restringe a participantes `VOTER` — inferido de que el resto de la mesa (contador "faltan N por votar") ya excluye espectadores en todas partes; no está dicho explícitamente en el handoff.

## Consecuencias

- La nota de ADR 0001 "Temporizador de discusión y ajustes de settings relacionados — bloque 8" queda parcialmente superada: F5 se construye aquí. Un futuro bloque 8 solo tendría sentido si hiciera falta más de lo que este ADR cubre (por ejemplo, resistencia a reinicios del proceso o un histórico de temporizadores).
- `participants` gana una columna de orden (`position`) que no existía; cualquier lectura futura de participantes debe seguir pidiendo orden explícito (`ORDER BY position`), igual que ya hacen `issues`/`rounds`.
- El contrato (`packages/contracts`) crece con un tipo de evento efímero (`EphemeralEvent`) deliberadamente fuera de la unión `ServerEvent` versionada — cualquier evento nuevo de "flair" (no un hecho de negocio) debe seguir ese mismo patrón en vez de forzarse dentro de `ServerEvent`.
