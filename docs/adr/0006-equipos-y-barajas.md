# 0006 — Equipos y barajas personalizadas (bloque 7)

## Contexto

El bloque 7 entrega lo que ADR 0001 y ADR 0005 dejaron fuera de alcance a propósito: `Team`,
`Deck.custom`, un selector de baraja real en la creación de partida, y un editor de barajas
personalizadas que persiste de verdad (el de bloque 6 era de solo lectura, con las dos barajas de
sistema hardcodeadas en el front). `docs/02-decisiones-y-plan.md` §2 fija el porqué del modelo
(`Team` ligero, sin cuentas) y un esquema SQL de referencia; este ADR documenta dónde el código
real se aparta de ese esquema y las decisiones de implementación que no estaban cerradas.

## Decisiones

- **`Team` es una entidad simple, no un agregado con invariantes de negocio.** `id`, `slug`
  (`TeamSlug`, formato kebab-case validado), `name` y `tokenHash`. No hay operaciones que mutar
  ni reglas que proteger más allá del formato del slug — a diferencia de `Game`, no hace falta
  encapsular nada.
- **El token nunca lo ve el dominio en claro.** `TokenHasher` (puerto en `application/ports/`,
  implementado por `HmacTokenHasher` en infraestructura con HMAC-SHA256 y `SESSION_SECRET` —
  el mismo secreto que ya valida `config/env.ts`, sin añadir uno nuevo) calcula el hash antes de
  construir el `Team`. `Team.hasTokenHash(candidateHash)` compara hashes, nunca secretos.
  `CreateTeam` es el único momento en que el token existe en claro en el servidor; se devuelve
  una vez en la respuesta y no se persiste.
- **`TeamNotFoundError` cubre "el slug no existe" y "el token no coincide" con el mismo mensaje.**
  Distinguir los dos casos en la respuesta permitiría enumerar slugs válidos por fuerza bruta.
- **Lectura de barajas pública, escritura con token — asimetría deliberada.** `GET /api/decks` y
  `GET /api/decks?teamSlug=` no piden token: los valores de las cartas no son un secreto y así el
  selector de baraja de `POST /api/games` funciona sin plumbing de sesión. Crear/editar/borrar
  (`POST|PATCH|DELETE /api/teams/:slug/decks...`) sí lo exige. El mismo criterio que ya separaba
  "cualquiera puede unirse a la partida" de "solo el facilitador cambia los ajustes".
- **`SavedDeck` es la fila persistida (`id`, `teamId | null`, `name`, `Deck`); `Deck` sigue siendo
  el VO de cartas sin nombre ni dueño**, tal cual ya lo usaba `Game`. Separar los dos evita que
  `Game` (que solo necesita las cartas) tenga que conocer conceptos de equipo.
- **`SavedDeck.createCustom` exige `teamId: TeamId` (no `TeamId | null`) — no `SavedDeck.of` a
  secas.** Hace estructuralmente imposible crear una baraja personalizada sin equipo, sin
  necesidad de una comprobación en tiempo de ejecución. Las dos barajas de sistema
  (`SYSTEM_DECKS`, `teamId: null`) se construyen con `reconstitute`, no con `createCustom`: no
  son algo que un caso de uso cree.
- **`Deck.custom(rawCards)` añade "?" y "☕" siempre, filtrando antes cualquier "?"/"☕" que el
  usuario ya haya escrito.** Sin el filtrado, escribir "?" a mano lanzaría `DuplicateCardError`
  al añadirlo de nuevo — el filtrado hace que pedirlas explícitamente sea un no-op, no un error.
- **IDs fijos para las dos barajas de sistema (`SYSTEM_DECK_IDS` en `domain/deck/SavedDeck.ts`),
  sembrados una vez por la migración `0003_teams_and_decks.ts`.** `CreateGame` ya no distingue
  "preset" de "baraja personalizada": todo pasa por `deckId` y `DeckRepository.findById`. Que las
  dos de sistema tengan ID estable es lo que permite tratarlas igual que cualquier baraja de
  equipo sin una rama de código aparte. Los IDs son literales duplicados a propósito entre el
  dominio y la migración (no hay forma de que una migración de Kysely importe código de
  `src/domain` sin acoplar el runner al build) — si alguna vez difieren, `findById` deja de
  resolver las de sistema y los tests de contrato (`tests/contract/*deck-repository*`) lo detectan
  inmediatamente.
- **`CreateGameCommand.deckPreset: 'fibonacci' | 'tshirt'` desaparece; ahora es `deckId: string`.**
  Es un cambio incompatible deliberado (no un alias ni una migración de compatibilidad): con
  barajas reales en BD, mantener el preset como atajo habría dejado dos caminos para lo mismo.
  Todos los llamadores (rutas HTTP, `CreateGamePage`, fixtures de test) se actualizan en el mismo
  bloque.
- **`games` NO gana una columna `team_id`, a pesar de que `docs/02-decisiones-y-plan.md` §2 la
  proponía.** Nada en el alcance de este bloque la consume: no hay pantalla de "partidas de mi
  equipo", y la elección de baraja ya no necesita saber de qué equipo es — `CreateGame` resuelve
  el `Deck` a partir del `deckId` sin mirar quién es su dueño. Añadirla ahora habría sido diseñar
  para un caso de uso hipotético, en contra de las reglas del proyecto. Si un futuro bloque
  necesita listar partidas por equipo, es una migración localizada, no un rediseño.
- **El editor de barajas dentro de una partida en curso (`DeckSettingsPanel` → `DeckEditorPanel`)
  sigue siendo de solo lectura.** Consecuencia directa de la decisión anterior: la partida no
  sabe a qué equipo pertenece, así que no hay token de equipo disponible ahí dentro con el que
  editar. El editor funcional vive en la página del equipo (`/t/:slug?k=token`,
  `features/team/TeamPage.tsx`), que si el facilitador quiere una baraja nueva para la partida
  siguiente, la crea ahí y la elige al crear la partida — no hace falta que la partida en curso
  sepa nada de equipos para que eso funcione.
- **`CreateGame` ya no decide la baraja por un `switch`: la busca por `deckId`.** Si el id no
  resuelve, `DeckNotFoundError` (404, mismo tratamiento que `GameNotFoundError`/
  `TeamNotFoundError` en `infrastructure/http/errors.ts`).

> **Añadido después (bloque 10):** `games.team_id` sí entró finalmente, en la migración
> `0004_games_team_id.ts`. Dejarlo fuera hacía que una partida creada desde `/?team=slug` copiara
> la baraja y perdiera el rastro del equipo, que es justo el vínculo que `docs/02` §2 preveía.
> `CreateGame` acepta un `teamSlug` opcional y **no exige token** para resolverlo, por coherencia
> con `ListDecks`: si leer las barajas de un equipo no lo pide, usarlas tampoco. El token sigue
> siendo lo único que permite _editar_ barajas. La FK es `on delete set null`, no `cascade`:
> borrar un equipo no puede llevarse por delante partidas ya jugadas.

## Fuera de alcance de este bloque (deliberado)

- `games.team_id` — ver más arriba.
- Pasar el token de equipo a una partida en curso para que el editor de barajas sea funcional
  también desde ahí — el editor de la página del equipo cubre el caso de uso real (preparar
  barajas antes de crear la partida) sin ese plumbing.
- Renombrar o transferir la propiedad de un equipo, y cualquier rotación/expiración del token —
  el mismo modelo "un solo link, sin recuperación" que ya usa el link de facilitador de `Game`.
- Un test e2e de socket para equipos/decks: a diferencia de `Game`, no hay canal de Socket.IO
  para `Team`/`SavedDeck` (todo es REST), así que no aplica el patrón de
  `tests/e2e/live-game.e2e.test.ts`.

## Consecuencias

- `packages/contracts` gana `TeamView`, `DeckSummaryView`, `createTeamCommandSchema`,
  `saveCustomDeckCommandSchema`, y `createGameCommandSchema.deckPreset` pasa a `deckId` — cambio
  incompatible para cualquier cliente que aún mande `deckPreset`.
- `tests/contract/` gana dos suites compartidas más (`teamRepositoryContract.ts`,
  `deckRepositoryContract.ts`), cada una ejercitada contra el adaptador en memoria y el de
  Postgres, mismo patrón que ya usaba `GameRepository`.
- El front gana dos pantallas nuevas (`/teams/new`, `/t/:slug`) fuera del brief de diseño original
  de Claude Design (bloque 6): se construyen con los mismos componentes de `design-system/`
  (`Button`, `Input`, `Tooltip`) para no inventar estilo nuevo, pero su composición en
  `features/team/` no viene de un handoff.
