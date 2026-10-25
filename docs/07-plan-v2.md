# Plan v2 — mejoras tras la v1.8

Este documento planifica la siguiente tanda de funcionalidades en el mismo formato que
`02-decisiones-y-plan.md` §5: **un bloque = una rama `feat/NN-nombre` desde `develop` = una PR**.
Cada bloque tiene ya su ADR en borrador en `docs/adr/` (0019–0028) con el contexto y las decisiones;
aquí está el detalle de implementación, los tests y los criterios de aceptación.

**Cómo usarlo con Claude Code:** antes de empezar un bloque, lee su sección aquí, su ADR y los
documentos que cite. Si la implementación se desvía de lo que dice el ADR, actualiza el ADR en la
misma PR (es la fuente de verdad de la decisión, no este plan). Al cerrar el bloque, actualiza la
línea «Estado» de `CLAUDE.md`.

**Ya existe, no rehacer:**

- «Volver a votar» sobre la misma tarea (`ResultsPanel` → `start_round` con la misma issue; el
  dominio numera la ronda con `roundNumber`). El bloque 12 solo añade la comparación entre rondas.
- Plumas para el voto más alto y capa para el más bajo tras revelar (`resultBadges.ts`).
- `Issue` ya tiene `description` y `externalUrl` en dominio y BD, pero no se exponen en `IssueView`
  ni se pueden rellenar desde la API. El bloque 15 los conecta.

---

## 1. Bloques

| #   | Bloque                            | Cubre                       | ADR  | Depende de | Migración |
| --- | --------------------------------- | --------------------------- | ---- | ---------- | --------- |
| 11  | Gestión de tareas                 | F10 completa                | 0019 | —          | No        |
| 12  | Comparar rondas al volver a votar | F6 ampliada                 | 0020 | —          | No        |
| 13  | Traspaso de facilitador           | F11 (traspaso)              | 0021 | —          | No        |
| 14  | Despertar la API                  | Operación en Render free    | 0022 | —          | No        |
| 15  | Importar tareas                   | F16 (importar) y F17        | 0023 | 11         | No        |
| 16  | Tiempos de ronda e histórico      | F7 (histórico)              | 0024 | —          | 0008      |
| 17  | Resumen de sesión                 | F7 (resumen)                | 0025 | 16         | No        |
| 18  | Exportar CSV y Markdown           | F16 (exportar), F7 (export) | 0026 | 15, 17     | No        |
| 19  | Votación asíncrona                | F2                          | 0027 | 11         | 0009      |
| 20  | Webhooks salientes                | F18 (genérico)              | 0028 | 15, 17     | 0010      |

Orden recomendado: el de la tabla. Los bloques 11, 13 y 19 tocan mucho `Game.ts`; hacerlos en
secuencia evita conflictos. El 14 es independiente y se puede adelantar.

El bloque 20 no integra ningún gestor concreto: envía webhooks y cada equipo los conecta con lo que
use (Jira Automation, n8n, Make, Zapier, una GitHub Action). Ver su ADR.

---

## 2. Reglas comunes a todos los bloques

Las reglas permanentes de `CLAUDE.md` siguen aplicando. Además, cada operación nueva de la partida
sigue el mismo recorrido que las existentes, en este orden:

1. **Dominio**: método en `Game` (o en la entidad que corresponda), con su error de dominio y su
   `GameEvent`. Un test por regla en `tests/domain/`, con el nombre de la regla.
2. **Contratos** (`packages/contracts`): esquema zod del comando, `ServerEvent` nuevo y cambios de
   vista. Primero los contratos, luego api y web los importan.
3. **Aplicación**: caso de uso fino (cargar → invocar → guardar → publicar) y su test en
   `tests/use-cases/` con el repositorio in-memory.
4. **Infraestructura**: ruta REST o handler de socket, traducción del evento en
   `WsEventPublisher`, cableado en `main.ts` y en `tests/e2e/support/testServer.ts`.
5. **Persistencia**: si cambia el estado guardado, test en la suite de contrato
   (`tests/contract/`), que corre contra in-memory y Postgres.
6. **Frontend**: el evento entra por `gameEventsReducer` (parche si el evento trae datos
   suficientes, `resync` si no) y la UI lee de `gameStore`.
7. **E2E**: obligatorio si el bloque añade cualquier dato que pueda contener votos ajenos
   (invariante 7). Inspecciona el payload crudo del socket, no la UI.

`PostgresGameRepository.save()` borra y reinserta participantes, issues, rondas y votos en el orden
del agregado. Consecuencia útil: borrar o reordenar issues en el dominio se persiste sin tocar el
repositorio. Consecuencia peligrosa: cualquier columna nueva que el mapper no escriba se pierde en
el siguiente `save`.

Commits del propio plan: `docs: ...` (sin scope; `commitlint` solo restringe los scopes cuando los
hay).

---

## 3. Bloque 11 — Gestión de tareas

**Objetivo.** Editar el título de una tarea, borrar las que sobran y reordenar la cola, desde el
panel de tareas. Hoy `Issue` solo se crea.

### Dominio

- `Issue.rename(title, description?, externalUrl?)` reutiliza la validación de `Issue.create`
  (`InvalidIssueTitleError`). `title`, `description` y `externalUrl` dejan de ser `readonly`.
- `Game.editIssue(issueId, changes, requestedBy, now)` → evento `IssueEdited`.
- `Game.removeIssue(issueId, requestedBy, now)` → evento `IssueRemoved`. Solo si la issue **nunca
  ha tenido ronda** (`IssueHasRoundsError` en otro caso). Ver ADR 0019 para el porqué.
- `Game.reorderIssues(orderedIds, requestedBy, now)` → evento `IssuesReordered`. `orderedIds`
  debe ser una permutación exacta de las issues actuales (`InvalidIssueOrderError` si falta, sobra
  o se repite alguna).
- Permisos: cualquier participante que no haya salido (mismo criterio que `addIssue`).
  `requestedBy` se valida con `requireParticipant`.

### Contratos y transporte

| Operación | REST                                    | Body                                                   | ServerEvent                           |
| --------- | --------------------------------------- | ------------------------------------------------------ | ------------------------------------- |
| Editar    | `PATCH /api/games/:id/issues/:issueId`  | `{ participantId, title, description?, externalUrl? }` | `issue_edited` `{ issue: IssueView }` |
| Borrar    | `DELETE /api/games/:id/issues/:issueId` | `{ participantId }`                                    | `issue_removed` `{ issueId }`         |
| Reordenar | `PUT /api/games/:id/issues/order`       | `{ participantId, issueIds: string[] }`                | `issues_reordered` `{ issueIds }`     |

Los tres eventos llevan datos suficientes para parchear el store sin `resync`. `externalUrl` se
valida en el borde con `z.string().url()`; el dominio guarda el string.

### Frontend (`features/issue-list`)

- Cada fila pendiente: menú con «Editar» (edición en línea del título) y «Borrar» (solo si
  `status === 'PENDING'` y no es la tarea actual; con confirmación).
- Reordenar arrastrando las tareas pendientes. Sin librería nueva si basta con la API nativa de
  drag and drop; en móvil, botones «subir / bajar» como alternativa accesible.
- El cambio se aplica de forma optimista y se revierte con un `Toast` si la API responde error.

### Tests

- Dominio: `permite renombrar una tarea`, `no permite dejar una tarea sin título`, `no permite
  borrar una tarea que ya se ha votado`, `no permite borrar la tarea de la ronda abierta`, `no
  acepta un orden que no contiene exactamente las tareas de la partida`, `quien ha salido no puede
  editar tareas`.
- Contrato: el orden y el título editado sobreviven a `save` + `findById`.
- E2E: dos clientes; uno reordena y el otro recibe `issues_reordered`.

### Criterios de aceptación

- Renombrar una tarea se ve al instante en todos los navegadores de la sala.
- Una tarea votada no ofrece «Borrar».
- El orden de la cola sobrevive a recargar la página y a reiniciar la API.

### Fuera de alcance

Borrar tareas con historial, permisos de edición configurables.

---

## 4. Bloque 12 — Comparar rondas al volver a votar

**Objetivo.** Tras «Volver a votar», poder ver la ronda anterior junto a la nueva: cómo cambió la
distribución y quién cambió su voto. Hoy la ronda anterior queda guardada pero `GameView` solo
expone `currentRound`.

### Dominio

Sin reglas nuevas. Un accesor de lectura `Game.roundsOf(issueId)` que devuelve las rondas de esa
issue en orden (no reutilizar `allRounds()`, que es solo para el mapper).

### Contratos

- `RoundView` gana `previousRounds: ReadonlyArray<PastRoundView>`: las rondas **reveladas o
  cerradas** de la misma issue, anteriores a la actual, en orden.
- `PastRoundView = { id, roundNumber, votes: { participantId, card: string }[], result: RoundResultView }`.
- `toGameView` filtra con `round.isRevealed()` **antes** de leer votos. Es una segunda vía por la
  que pueden salir votos del servidor, así que hereda la invariante 7.

### Frontend (`features/results-panel`)

- Si `previousRounds.length > 0`, el panel revelado muestra «Comparar con la ronda N»: dos
  `DistributionBar` (anterior y actual) y la lista de quién cambió su voto (`Ana 3 → 5`).
- Los votos de quien ya salió se muestran como «Alguien que ya no está» (su `participantId` no
  está en `participants`).

### Tests

- Read model: `no incluye en previousRounds una ronda abierta`, `previousRounds solo contiene
  rondas de la misma tarea`.
- E2E: con una ronda 1 revelada y la ronda 2 abierta, el payload crudo de `state_sync` contiene los
  votos de la ronda 1 y ningún valor ajeno de la ronda 2.

### Criterios de aceptación

- Revelar la segunda ronda de una tarea muestra la comparación sin acción extra.
- Pasar a la siguiente tarea no arrastra comparaciones de la anterior.

---

## 5. Bloque 13 — Traspaso de facilitador

**Objetivo.** Que la sala no se quede bloqueada cuando el facilitador se va: puede cederlo, y si
desaparece, otro puede tomar el relevo. Hoy `isFacilitator` es inmutable y el facilitador no puede
salir (`FacilitatorCannotLeaveError`).

### Dominio

- `Participant.isFacilitator` pasa a estado privado con un getter `get isFacilitator()`, para no
  tocar los usos existentes. Métodos `promote()` / `demote()`.
- `Game.transferFacilitator(toId, requestedBy, now)`: solo el facilitador actual
  (`FacilitatorTransferNotAllowedError`); el destino debe existir y no haber salido; transferirse a
  uno mismo es un no-op. Evento `FacilitatorChanged { previousId, nextId }`.
- `Game.claimFacilitator(requestedBy, now, present)`: cualquiera, solo si `present` es conocido y
  el facilitador actual **no** está en él (`FacilitatorStillPresentError`). Con `present`
  `undefined` (API recién arrancada) se rechaza: no se puede saber si se fue. Mismo patrón que
  `reconcileAutoReveal` (ADR 0015).
- `FacilitatorCannotLeaveError` se mantiene: para salir, el facilitador cede primero.

### Contratos y transporte

| Operación    | REST                                    | Body                                 |
| ------------ | --------------------------------------- | ------------------------------------ |
| Ceder        | `POST /api/games/:id/facilitator`       | `{ participantId, toParticipantId }` |
| Tomar relevo | `POST /api/games/:id/facilitator/claim` | `{ participantId }`                  |

Casos de uso `TransferFacilitator` y `ClaimFacilitator` (este último recibe `PresenceReader`).
ServerEvent `facilitator_changed { previousId, nextId }`, parcheable.

### Frontend

- Menú del asiento de otro participante (solo lo ve el facilitador): «Hacer facilitador», con
  confirmación.
- «Salir de la sala» siendo facilitador abre un diálogo para elegir sucesor; al confirmar, cede y
  sale.
- Si el facilitador aparece `online: false`, banner discreto para el resto: «El facilitador no
  está conectado» con botón «Tomar el relevo».

### Tests

- Dominio: `solo el facilitador puede cederlo`, `no se puede ceder a quien ha salido`, `tras ceder,
  el anterior pierde los permisos de facilitador`, `se puede tomar el relevo si el facilitador no
  está presente`, `no se puede tomar el relevo si el facilitador está presente`, `no se puede tomar
  el relevo sin saber quién está presente`.
- Contrato: el nuevo facilitador sobrevive a `save` + `findById`.
- E2E: el facilitador se desconecta, pasa la gracia (`presenceGraceMs` corto en `testServer`) y
  otro cliente toma el relevo.

### Criterios de aceptación

- Con `whoCanReveal: FACILITATOR_ONLY`, tras ceder solo revela el nuevo facilitador.
- El facilitador puede salir de la sala pasando por el diálogo de sucesor.

---

## 6. Bloque 14 — Despertar la API

**Objetivo.** Que el arranque en frío de Render free no parezca un fallo. `06-despliegue.md` §2.2
descarta un ping permanente; esto no lo contradice: se despierta la API **cuando alguien abre la
app**, y se le dice al usuario qué pasa.

### Frontend (`shared/api/serverWarmup.ts` + store)

- Al cargar la app, `GET /health` con timeout corto y reintentos con espera creciente hasta ~90 s.
- Estado `serverStatus: 'checking' | 'waking' | 'ready' | 'unreachable'` en un store de `shared/`.
- Si tras 2 s no hay respuesta, banner: «Despertando el servidor… el primer arranque puede tardar
  hasta un minuto». Al pasar a `ready`, desaparece.
- Los botones de crear partida, unirse y crear equipo se deshabilitan mientras `serverStatus` no
  sea `ready`, con el motivo visible. En `unreachable`, botón «Reintentar».
- El banner es un componente puro en `design-system/` (texto y variante por props); la lógica vive
  en `shared/`.

### Opcional: workflow de calentamiento

`warmup.yml` con `workflow_dispatch` y un `schedule` comentado de ejemplo (p. ej. el día de la
planificación, 10 minutos antes). Hace `curl` a `/health` con reintentos. Desactivado por defecto:
activarlo es decisión del equipo, no del bloque.

### Tests

- Unitarios de `serverWarmup` con reloj y `fetch` falsos: pasa a `waking` a los 2 s, a `ready` con
  la primera respuesta 200, a `unreachable` al agotar reintentos.

### Criterios de aceptación

- Con la API dormida, abrir el enlace muestra el banner en vez de un error, y la sala carga sola al
  despertar.
- Con la API despierta, el banner no llega a aparecer.

---

## 7. Bloque 15 — Importar tareas

**Objetivo.** Cargar la cola de una sesión de una vez: pegando una lista, un CSV o URLs de tareas.

### Dominio

- `Game.importIssues(entries, now)` con `entries: { id, title, description?, externalUrl? }[]`.
  Valida cada título con `Issue.create`; si alguno falla, no añade ninguno. Registra **un** evento
  `IssuesImported { issueIds }`, no uno por issue (con N `IssueAdded` el front haría N `resync`).
- `addIssue` acepta también `description` y `externalUrl` opcionales.

### Contratos y transporte

- `IssueView` gana `description: string | null` y `externalUrl: string | null`.
- `POST /api/games/:id/issues/batch` con `{ issues: [{ title, description?, externalUrl? }] }`,
  máximo 200. Caso de uso `ImportIssues`.
- `addIssueCommandSchema` acepta `description?` y `externalUrl?`.
- ServerEvent `issues_imported { issueIds }` → `resync`.

### Frontend (`features/issue-import`)

- En el panel de tareas, «Importar»: modal con un área de texto y opción de subir un `.csv`.
- `parseIssueInput(text)` — función pura, sin dependencias:
  - Si la primera línea es una cabecera CSV reconocible (`summary`/`title`/`título`, `key`,
    `description`/`descripción`, `link`/`url`), se parsea como CSV con comillas y separador `,` o
    `;` detectado. La columna `estimate` se ignora.
  - Si no, una tarea por línea no vacía.
  - Una línea que es una URL se convierte en tarea con `externalUrl` y un título derivado por
    `issueKeyFromUrl(url)`: Jira `/browse/ABC-123` → `ABC-123`; GitHub `/owner/repo/issues/42` →
    `repo#42`; Linear `/issue/ABC-12/slug` → `ABC-12`; en otro caso, el último segmento del path.
- `issueKeyFromUrl` vive en `packages/contracts/src/issueKey.ts` (función pura): el bloque 18 la
  reutiliza para la columna `key` del CSV exportado y el bloque 20 para el campo `key` de los
  webhooks, que se construyen en la api.
- Vista previa en tabla con casilla por fila antes de importar, y aviso si se superan 200.
- La lista muestra un icono de enlace en las tareas con `externalUrl`.

### Tests

- Dominio: `importar tareas no añade ninguna si un título es inválido`, `importar tareas registra
  un único evento`.
- `parseIssueInput`: lista simple, CSV con comillas y saltos de línea, separador `;`, URLs de Jira,
  GitHub y Linear, líneas vacías.
- E2E: importar 3 tareas produce un único `issues_imported`.

### Criterios de aceptación

- Pegar diez URLs de Jira crea diez tareas con su clave como título y su enlace.
- Un CSV exportado desde Jira o Linear con columna `Summary` se importa sin editarlo.

---

## 8. Bloque 16 — Tiempos de ronda e histórico de partidas

**Objetivo.** Poder volver a partidas anteriores del equipo y saber cuánto llevó cada tarea. Los
datos de rondas ya están en BD; faltan los tiempos y la vista.

### Dominio

- `Round` gana `openedAt: Date | null` (fijado en `Round.open`, `null` en rondas antiguas).
- `Issue` gana `estimatedAt: Date | null`; `Issue.estimate(card, now)` lo fija.
- `reconstitute` de ambos acepta los campos nuevos.

### Persistencia

Migración `0008_round_and_issue_timestamps`: `rounds.opened_at timestamptz null` e
`issues.estimated_at timestamptz null`. Los mappers los escriben siempre (ver §2 sobre
`save()`). Test de contrato para ambos.

### Lado de lectura

- Puerto nuevo `GameHistoryReader` en `application/ports`:
  `listTeamGames(teamId, { limit, before? }): Promise<TeamGameSummary[]>` con
  `{ id, name, createdAt, issueCount, estimatedCount, participantCount }`.
- Es un puerto de consulta, no un método de `GameRepository`: listar no necesita reconstruir
  agregados (ver ADR 0024).
- `PostgresGameHistoryReader` (una consulta con agregados sobre `games`, `issues` y
  `participants`) e `InMemoryGameHistoryReader`. Suite de contrato común.
- Caso de uso `ListTeamGames`: autentica el equipo con su token (mismo mecanismo que
  `GET /api/teams/:slug`).
- `GET /api/teams/:slug/games?k=<token>&limit=20&before=<iso>`, paginado por `createdAt`.

### Frontend

- `TeamPage`: pestaña «Partidas» con la lista (nombre, fecha, tareas estimadas / total). Cada fila
  abre la sala y, cuando exista el bloque 17, su resumen.
- Las partidas creadas fuera de un equipo no tienen dueño y no se listan en el servidor. En la
  portada, «Partidas recientes» desde `localStorage` (`shared/games/rememberedGames.ts`, mismo
  patrón que `rememberedTeams.ts`), guardada al entrar en una sala.

### Tests

- Dominio: `una ronda nueva guarda cuándo se abrió`, `estimar una tarea guarda cuándo se estimó`.
- Contrato de `GameHistoryReader`: solo devuelve partidas del equipo pedido, orden descendente por
  fecha, paginación con `before`.
- Caso de uso: `no lista partidas con un token de equipo incorrecto`.

### Criterios de aceptación

- La página del equipo lista sus partidas de la más reciente a la más antigua.
- Las rondas abiertas antes de la migración siguen cargando (tiempos `null`).

---

## 9. Bloque 17 — Resumen de sesión

**Objetivo.** Una vista de cierre de la sesión: qué se estimó, cuánto suma, dónde no hubo
consenso y cuánto llevó cada tarea.

### Lado de lectura

- `toGameSummaryView(game)` en `application/read-models/`, función pura sobre el agregado.
- Caso de uso `GetGameSummary`; `GET /api/games/:id/summary`.
- `GameSummaryView`:
  - Por tarea: `title`, `externalUrl`, `description`, `status`, `finalEstimate`, `rounds`
    (número de rondas reveladas), `agreementPercentage` y `average` de la última ronda revelada,
    `durationMs` (`estimatedAt` − `openedAt` de su primera ronda; `null` si falta algún dato).
  - Totales: tareas estimadas / pendientes; suma de estimaciones numéricas; recuento por valor
    cuando la baraja no es numérica (tallas); tareas con consenso total; tareas que necesitaron
    más de una ronda; duración media; número de votantes distintos.
- **Solo agregados, sin votos individuales** (ADR 0025). Las rondas abiertas no aportan nada.

### Frontend (`features/session-summary`)

- Ruta `/games/:gameId/summary`, accesible desde un botón «Resumen» en la `TopBar` y desde el
  histórico del equipo.
- Cuando no quedan tareas pendientes y la última está estimada, el panel de resultados ofrece
  «Ver resumen de la sesión».
- Tarjetas con los totales y una tabla por tarea; resaltadas las de bajo acuerdo (< 50 %) o con
  varias rondas.

### Tests

- Read model: `la suma ignora estimaciones no numéricas`, `una ronda abierta no cuenta en el
  resumen`, `la duración es nula si la ronda es anterior a la migración`, `el resumen no contiene
  votos individuales`.

### Criterios de aceptación

- Al acabar una sesión, el resumen muestra el total de puntos y señala las tareas sin consenso.
- Funciona igual para partidas antiguas, con duraciones vacías.

---

## 10. Bloque 18 — Exportar CSV y Markdown

**Objetivo.** Llevar el resultado de la sesión al gestor de tareas o a un documento.

### Decisión de diseño

La exportación se genera **en el cliente** a partir de `GameSummaryView` (ADR 0026). El servidor
sigue hablando solo JSON.

### Frontend (`features/session-summary/export`)

- `toCsv(summary, { separator })`: columnas `summary, key, description, link, estimate, rounds,
  agreement` (las cinco primeras compatibles con F16 y con la importación del bloque 15). `key` sale
  de `issueKeyFromUrl`. Comillas y escapes RFC 4180; BOM UTF-8; separador `;` por defecto (Excel en
  español) con opción `,`.
- `toMarkdown(summary)`: tabla con tarea (enlazada si hay URL), estimación, rondas y acuerdo, más
  una línea de totales. Pensada para pegar en Confluence, Notion o un PR.
- Botones en el resumen: «Descargar CSV», «Copiar Markdown».
- Nombre de fichero: `planning-<nombre-de-partida>-<aaaa-mm-dd>.csv`.

### Tests

- `toCsv`: títulos con comas, comillas y saltos de línea; separador `;`; BOM presente.
- Ida y vuelta: `parseIssueInput(toCsv(x))` recupera títulos, enlaces y descripciones.
- `toMarkdown`: escapa `|` en los títulos.

### Criterios de aceptación

- El CSV se abre bien en Excel en español sin pasar por el asistente de importación.
- Un CSV exportado se puede importar en otra partida con el bloque 15.

---

## 11. Bloque 19 — Votación asíncrona

**Objetivo.** Abrir varias tareas para que cada uno vote cuando pueda (antes de la reunión) y
revelarlas en lote. Es F2 de `01-especificacion.md`.

### Modelo (ver ADR 0027)

- `Round` gana `mode: 'LIVE' | 'ASYNC'`. El `RoundStatus` no cambia (`OPEN`, `REVEALED`,
  `CLOSED`). Se elige un modo en vez del «status extra» que anticipaba `02` §6: el ciclo de vida es
  el mismo y lo que cambia es cómo convive con las demás rondas.
- Varias rondas `ASYNC` pueden estar `OPEN` a la vez, una por tarea, y conviven con una ronda en
  vivo.
- `openRound()` y `currentRound()` pasan a considerar **solo rondas `LIVE`**. Todo lo que hoy
  depende de ellas (auto-revelado, cuenta atrás, dealer, `castVote`) no cambia de comportamiento.

### Dominio

- `Game.openAsyncRounds(entries, requestedBy, now)`, con `entries: { roundId, issueId }[]`: cada
  issue debe estar `PENDING` y sin ronda abierta (`IssueNotPendingError`). Sin cuenta atrás.
  Evento `AsyncRoundsOpened`.
- `Game.castAsyncVote(participantId, issueId, card, now)`: mismas reglas que `castVote`
  (espectador, carta en baraja, `allowVoteChange`), sin auto-revelado. Evento `AsyncVoteCast`.
- `Game.revealAsyncRounds(issueIds | 'ALL', requestedBy, now)`: exige `canReveal`; revela las
  rondas asíncronas abiertas con al menos un voto. Evento `AsyncRoundsRevealed`.
- `Game.startVotingRound` sobre una issue con ronda asíncrona abierta **la absorbe**: crea la ronda
  en vivo con sus votos y retira la asíncrona. Quien votó en diferido no tiene que repetir.
- `Game.setFinalEstimate(card, requestedBy, now, issueId?)`: con `issueId`, cierra la última ronda
  de esa issue si está revelada (sirve para las asíncronas); sin él, comportamiento actual.
- `Game.changeDeck` también se rechaza con rondas asíncronas abiertas
  (`DeckChangeDuringVotingError`), por el mismo motivo que ADR 0014.

### Contratos

- `GameView.asyncRounds: AsyncRoundView[]` con
  `{ roundId, issueId, status, voterIds, ownCard, votes, result }`. `votes` y `result` solo con la
  ronda revelada; antes, solo `voterIds` y el `ownCard` del viewer. **Invariante 7.**
- Comandos WS: `open_async_rounds { issueIds }`, `async_vote { issueId, card }`,
  `reveal_async { issueIds? }` (ausente = todas), y `set_estimate` acepta `issueId?`.
- ServerEvents: `async_rounds_opened` (resync), `async_vote_cast { issueId, participantId }`
  (parche, sin carta), `async_rounds_revealed` (resync).

### Persistencia

Migración `0009_rounds_mode`: `rounds.mode text not null default 'LIVE'`. Mapper y contrato.

### Frontend

- Panel de tareas: seleccionar pendientes → «Abrir para votar en diferido».
- Cada tarea en diferido muestra «3 de 6 han votado» y un botón «Votar» que abre la mano de cartas
  en un modal; marca la propia carta elegida.
- Quien puede revelar ve «Revelar todas» (y por tarea).
- Panel «Resultados en diferido»: por tarea revelada, distribución, media, acuerdo y selector para
  aceptar la estimación; o «Votar en vivo» para discutirla en la mesa.

### Tests

- Dominio: `se pueden tener abiertas varias rondas asíncronas a la vez`, `una ronda asíncrona no
  impide abrir una ronda en vivo`, `no se puede abrir en diferido una tarea ya estimada`, `un
  espectador no puede votar en diferido`, `votar en diferido nunca revela automáticamente`,
  `revelar en lote ignora las rondas sin votos`, `abrir en vivo una tarea en diferido conserva sus
  votos`, `no se puede cambiar la baraja con rondas asíncronas abiertas`.
- Contrato: `mode` sobrevive a `save` + `findById`.
- **E2E obligatorio**: tres clientes votan en diferido; antes del revelado, ningún payload crudo
  contiene la carta de otro.

### Criterios de aceptación

- Se abren cinco tareas en diferido el lunes, cada uno vota durante la semana y en la reunión se
  revelan de golpe.
- Con rondas en diferido abiertas, la mesa en vivo funciona igual que hoy.

---

## 12. Bloque 20 — Webhooks salientes

**Objetivo.** Llevar lo que pasa en la app a cualquier gestor o herramienta sin integrar ninguno en
concreto. La app avisa por HTTP de los hechos relevantes y cada equipo conecta ese aviso con lo que
use: Jira Automation, n8n, Make, Zapier o una GitHub Action. La entrada de tareas sigue siendo la
del bloque 15 (URLs y CSV), que ya es genérica.

### Dominio (`domain/team`)

- Entidad `Webhook` dentro de `Team`: `id`, `url`, `events`, `secret`.
- VO `WebhookUrl`: solo `https` (`InsecureWebhookUrlError`). La comprobación de red (que no apunte a
  una IP privada) es de infraestructura, no del dominio.
- `WebhookEvent`: `'issue.estimated' | 'issues.imported' | 'session.summary'`. Al menos uno por
  webhook.
- `Team.addWebhook(id, url, events, secret)`, `Team.removeWebhook(id)`. Máximo 3 por equipo
  (`TooManyWebhooksError`).
- El secreto lo genera la api (puerto `IdGenerator` o uno nuevo `SecretGenerator`), nunca el
  usuario.

### Eventos que se envían

| Evento            | Cuándo                                                   | Datos principales                                  |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `issue.estimated` | Al aceptar la estimación de una tarea (`IssueEstimated`) | tarea, `key`, enlace, estimación, rondas y acuerdo |
| `issues.imported` | Al importar tareas (`IssuesImported`, bloque 15)         | lista de tareas con `key` y enlace                 |
| `session.summary` | Al pulsar «Enviar resumen» en el resumen (bloque 17)     | `GameSummaryView` completo                         |
| `ping`            | Al pulsar «Enviar prueba» en la página del equipo        | solo cabeceras y equipo                            |

Solo se envían para partidas creadas dentro de un equipo: sin equipo no hay dónde configurar el
webhook.

### Formato del envío

- `POST` con `Content-Type: application/json` y cuerpo versionado:
  `{ "version": 1, "event", "deliveryId", "occurredAt", "team": { slug, name }, "game": { id, name, url }, "data": {...} }`.
- `data` de `issue.estimated`: `{ issueId, title, key, externalUrl, finalEstimate, numericEstimate, rounds, agreementPercentage }`.
  `key` sale de `issueKeyFromUrl` (bloque 15). **Nunca votos individuales** (mismo criterio que el
  resumen, ADR 0025).
- Cabeceras: `X-PP-Event`, `X-PP-Delivery`, `X-PP-Timestamp` y
  `X-PP-Signature: sha256=<hex>`, HMAC-SHA256 de `"<timestamp>.<cuerpo>"` con el secreto del
  webhook. El receptor puede verificarla y rechazar marcas de tiempo de más de 5 minutos.
- Los esquemas del cuerpo viven en `packages/contracts/src/webhooks.ts` para que la documentación y
  los tests usen el mismo tipo.

### Aplicación

- `DispatchWebhooks`: reacciona a `IssueEstimated` e `IssuesImported`. Carga la partida; si no
  tiene equipo, no hace nada. Carga los webhooks del equipo suscritos a ese evento, construye el
  cuerpo con un read model puro (`toWebhookPayload`) y lo entrega por el puerto `WebhookSender`.
- Se engancha con un `EventPublisher` compuesto en infraestructura (el actual por socket + el de
  webhooks), cableado en `main.ts`. El dominio no sabe que existen los webhooks.
- `SendSessionSummary` (`POST /api/games/:id/summary/webhook`, `{ participantId }`) y
  `TestWebhook` (`POST /api/teams/:slug/webhooks/:webhookId/test?k=`).
- Gestión: `GET`, `POST` y `DELETE /api/teams/:slug/webhooks?k=<token>`. El `POST` devuelve el
  secreto **una sola vez**; los listados solo muestran URL, eventos y los 4 últimos caracteres del
  secreto.

### Infraestructura

- `FetchWebhookSender` con `fetch` nativo: timeout de 5 s, sin seguir redirecciones, y hasta 3
  reintentos con espera creciente (1 s, 5 s, 25 s) ante errores de red o respuestas 5xx. Los 4xx no
  se reintentan.
- **Protección SSRF**: antes de cada envío se resuelve el DNS y se rechaza si apunta a una
  dirección privada, de loopback, link-local o de metadatos. Sin esto, cualquiera con el token de un
  equipo podría hacer que la api llame a servicios internos de Render.
- Firma con `node:crypto` (como `HmacTokenHasher`).
- Los reintentos viven en memoria: si la api se reinicia a mitad, la entrega se pierde. Aceptado
  para una herramienta interna (ADR 0028).
- Si una entrega agota los reintentos, se emite `webhook_failed { event, issueId? }` a la sala por
  `RealtimeBroadcaster`. Nunca deshace la acción que la provocó.

### Persistencia

Migración `0010_team_webhooks`: tabla `team_webhooks` (`id`, `team_id` con `on delete cascade`,
`url`, `events` jsonb, `secret`, `created_at`), con RLS activado como el resto de tablas públicas
(ADR 0013). `PostgresTeamRepository` la carga y guarda con el equipo; test de contrato.

### Frontend

- `TeamPage`, sección «Webhooks»: alta (URL y casillas de eventos), secreto mostrado una vez con
  botón de copiar, «Enviar prueba» con el resultado (código HTTP o error), y borrar.
- Resumen de sesión (bloque 17): «Enviar resumen» si la partida es de un equipo con un webhook
  suscrito a `session.summary`.
- `Toast` en la sala ante `webhook_failed`.

### Documentación para el equipo

El bloque crea `docs/08-webhooks.md`, pensado para quien configura el receptor, no para Claude Code:

- Esquema de cada evento con un ejemplo real.
- Cómo verificar la firma, con un fragmento en Node.
- Receta para Jira Automation: disparador «Incoming webhook», buscar la tarea por `{{webhookData.data.key}}`
  y editar el campo de story points con `{{webhookData.data.numericEstimate}}`.
- Receta para n8n (Webhook → Linear/GitHub) y para una GitHub Action vía `repository_dispatch`.

### Tests

- Dominio: `un webhook solo acepta URLs https`, `un webhook necesita al menos un evento`, `un equipo
  no puede tener más de tres webhooks`.
- Read model: `el cuerpo de issue.estimated no contiene votos individuales`, `la clave se deriva de
  la URL externa`.
- Caso de uso: `no envía webhooks de una partida sin equipo`, `solo envía a los webhooks suscritos
  al evento`, `un fallo de entrega no deshace la estimación`.
- Infraestructura: firma verificable con el secreto; rechazo de `127.0.0.1`, `10.0.0.0/8`,
  `169.254.169.254` y de un nombre que resuelve a IP privada; reintento ante 503 y no ante 400. Todo
  contra un servidor HTTP local, sin red real en CI (la comprobación SSRF se inyecta para poder
  probar contra `localhost`).
- E2E: estimar una tarea en una partida de equipo llega a un receptor local con firma válida.

### Criterios de aceptación

- Configurar un webhook en el equipo y recibir el `ping` en un receptor de prueba.
- Con una regla de Jira Automation siguiendo `08-webhooks.md`, aceptar una estimación actualiza los
  story points de la tarea en Jira.
- Con el receptor caído, la sesión sigue funcionando y la sala ve el aviso.

### Fuera de alcance

Registro histórico de entregas, reenvío manual de entregas fallidas, adaptadores específicos de un
gestor (el puerto `IssueTracker` queda como posible bloque futuro si alguno lo merece).
