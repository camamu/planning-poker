# 0024 — Tiempos de ronda e histórico de partidas

_Implementado en el bloque 16 (`docs/07-plan-v2.md` §8)._

## Contexto

`02-decisiones-y-plan.md` §6 dejó el histórico fuera de la v1 notando que los datos ya estaban en
la BD (tabla `rounds`, que el plan llamaba `voting_rounds`) y solo faltaba la vista. Faltan también
dos datos para saber cuánto llevó cada tarea: cuándo se abrió una ronda (solo se guarda
`revealed_at`) y cuándo se estimó la tarea.

## Decisión

- **`Round.openedAt` e `Issue.estimatedAt`**, fijados por el dominio con el `now` que ya reciben
  `startVotingRound` y `setFinalEstimate`. Migración `0008_round_and_issue_timestamps`
  (`rounds.opened_at` e `issues.estimated_at`, `timestamptz null`): las rondas y tareas anteriores
  quedan con tiempos desconocidos en vez de inventados. Son parámetros **obligatorios** de
  `Round.open`/`Round.reconstitute` e `Issue.estimate`/`Issue.reconstitute` (con `null` explícito
  para «desconocido»): así un mapper que no los escriba no compila, en vez de perderlos en
  silencio en el siguiente `save()`.
  - Una tarea que vuelve a votarse conserva su `estimatedAt` anterior hasta que se vuelva a
    estimar: es «la última vez que se estimó». El resumen del bloque 17 solo lo lee en tareas
    `ESTIMATED`.
- **Puerto de consulta `GameHistoryReader`**, separado de `GameRepository`. Listar partidas no es
  una operación sobre un agregado: reconstruir cada `Game` con todas sus rondas y votos para
  mostrar un nombre y dos contadores sería caro y no aporta invariantes. Implementación Postgres con
  una consulta agregada e in-memory para tests, con suite de contrato común
  (`tests/contract/support/gameHistoryReaderContract.ts`). Como `createdAt` lo pone el adaptador y
  no el agregado, la suite recibe de cada adaptador una función `saveGameCreatedAt(game, fecha)`
  para fijarlo; por eso `InMemoryGameRepository` acepta un reloj en el constructor.
  - `listSummaries()` del panel de gestión (ADR 0030) ya vivía en `GameRepository` cuando se
    implementó este bloque; no se ha movido. Es una consulta global sin filtro ni paginación,
    distinta de esta, y moverla es un refactor que nadie ha pedido. Si aparece una tercera consulta
    de este tipo, las dos pasan a `application/queries/`.
  - El lector in-memory se apoya en `listSummaries()` para no duplicar el recuento.
- **El histórico es del equipo**: `GET /api/teams/:slug/games?k=<token>&limit=&before=`, con el mismo
  token que la página del equipo (`resolveTeam`: un token ajeno es 404, como en el resto de rutas
  del equipo). Responde un array de `TeamGameView` (`id`, `name`, `createdAt`, `issueCount`,
  `estimatedCount`, `participantCount`, este último sin contar a quien ya ha salido, igual que el
  panel de gestión). `limit` va de 1 a 100 (20 por defecto) y se valida en el borde con
  `teamGamesQuerySchema`. Las partidas sin equipo no tienen dueño y el servidor no puede listarlas sin
  exponer las de todo el mundo (mismo razonamiento que `rememberedTeams.ts`); en su lugar, la portada
  recuerda las partidas visitadas en `localStorage`.
- Paginación por fecha (`before`), no por desplazamiento: las partidas nuevas no desplazan páginas.
  `before` es el `createdAt` de la última fila vista y excluye esa fecha (`<` estricto); se ordena
  por `created_at desc, id desc`. No hay `nextCursor` ni total: el cliente entiende que hay más si
  la página vino llena, así que con un número de partidas múltiplo del límite el último «Ver
  partidas anteriores» devuelve una página vacía. Postgres guarda microsegundos y el cursor viaja
  en milisegundos: dos partidas del mismo equipo creadas en el mismo milisegundo justo en el corte
  de página podrían saltarse una; aceptado, las crea una persona a mano.
- **Partidas sin equipo**: `shared/games/rememberedGames.ts` guarda en `localStorage` (`pp:games`)
  las últimas 10 salas en las que se ha entrado, con la fecha de visita, y la portada las lista como
  «Partidas recientes» con «Entrar» y «Quitar». Se registran cuando llega el estado de la sala
  (`useGameTable`), no al crearla, para que también cuenten las salas a las que se entra por
  enlace. Solo aparecen en la portada sin equipo: con `?team=` el formulario ya es de ese equipo.
- **Interfaz del equipo**: `TeamPage` gana pestañas «Barajas» / «Partidas». Cada fila abre la sala
  (`/games/:id`); el enlace al resumen llega con el bloque 17.

## Consecuencias

- Los mappers de rondas e issues escriben los campos nuevos siempre; si no, el siguiente `save()`
  los borraría. El test de contrato fija que sobreviven a `save` + `findById` y que lo guardado sin
  ellos se recarga con `null`.
- `GameHistoryReader` es el primer puerto solo de lectura; si aparecen más consultas así, se
  agrupan en `application/queries/`.
- `/api/teams/:slug/games` lee de `games.team_id`, que ya existe desde `0004`. Borrar el equipo la
  deja a `null` (`on delete set null`), así que sus partidas dejan de aparecer en cualquier
  histórico; siguen existiendo y accesibles por su enlace.
- Las partidas anteriores a la migración 0008 se listan igual: el histórico solo usa `games`,
  `issues` y `participants`. Sus tiempos desconocidos solo afectan a las duraciones del bloque 17.
