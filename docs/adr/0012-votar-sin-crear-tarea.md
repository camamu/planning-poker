# 0012 — Votar sin crear la tarea antes (ronda rápida)

## Contexto

Hasta ahora `Game.startVotingRound` exige una `Issue` ya existente (`IssueNotFoundError` si no la
hay), y el único camino del front para llegar a la mesa de votación era: abrir la cola de tareas
(`IssueListPanel`), escribir un título, añadirla y luego pulsar sobre ella. Para una estimación
suelta ("¿cuánto vale esto que estamos discutiendo ahora mismo?") ese paso previo es fricción
pura: se pide fuera del plan de bloques, directamente al dueño del repositorio.

## Decisión

- **`Game.startQuickRound(issueId, roundId, now)`** crea una `Issue` con título por defecto
  (`Ronda rápida N`, `N` = nº de issues ya en la partida + 1) y abre la ronda sobre ella en el
  mismo método. Comprueba `AnotherRoundOpenError` **antes** de crear la issue, para no dejar una
  issue huérfana sin ronda si ya había una abierta. Por lo demás no duplica ninguna invariante:
  llama tal cual a `addIssue`/`startVotingRound`, que siguen siendo el único sitio donde viven
  "título no vacío" y "como mucho una ronda abierta a la vez".
- **No es un caso de uso nuevo con lógica propia — es orquestación fina, igual que el resto.**
  `StartQuickRound` (application) hace lo de siempre: carga la partida, invoca el método de
  dominio, persiste, publica. La decisión de negocio (qué título por defecto, en qué orden
  comprobar) vive entera en `Game`, no en el caso de uso.
- **Reutiliza los eventos de dominio existentes.** `startQuickRound` emite `IssueAdded` y
  `VotingRoundStarted`, los mismos dos eventos que ya emitía el camino manual
  (`addIssueAndOpenRound` en los tests). `WsEventPublisher` no cambia: ya sabía traducir ambos a
  `issue_added`/`round_started`, y el reductor del front ya pedía un resync para los dos. Cero
  cambios en `packages/contracts/src/events.ts` ni en `gameEventsReducer.ts`.
- **Un comando WS nuevo, no una variante del existente.** `start_quick_round`
  (`wsStartQuickRoundCommandSchema: { gameId, participantId }`) en vez de hacer `issueId` opcional
  en `wsStartRoundCommandSchema`: mantiene cada comando con una única forma de payload y evita que
  `StartVotingRound.execute` tenga que decidir con un `if` a qué issue abrir la ronda.
- **Sin restricción de quién puede pulsar "Votar ya".** Mismo criterio que ya tenía
  `startVotingRound`: no comprueba facilitador ni ningún otro rol. Cambiarlo sería una decisión de
  producto aparte, no algo que este ADR introduce por su cuenta.
- **Frontend: un botón en `ResultsPanel`, no una pantalla nueva.** El estado "no hay ronda
  abierta" ya existía (antes solo mostraba un texto); gana un botón "Votar ya" que llama a
  `startQuickRound()` del store, mismo patrón que `startRound(issueId)`.

## Fuera de alcance (deliberado)

- Renombrar la issue generada después del hecho — el facilitador puede seguir usando la cola de
  tareas normal para eso; no hace falta un editor de título dedicado para esta vía rápida.
- Restringir "Votar ya" por rol/permiso — no hay precedente de eso en `startVotingRound` y añadirlo
  aquí sería diseñar una regla de producto no pedida.

## Consecuencias

- `packages/contracts` gana `wsStartQuickRoundCommandSchema`/`WsStartQuickRoundCommandInput`.
  `ServerEvent`/`EphemeralEvent` no cambian.
- `SocketGatewayDependencies` gana `startQuickRound`; `main.ts` y `tests/e2e/support/testServer.ts`
  quedan al día con el mismo cableado que el resto de casos de uso.
