# 0015 — Panel de gestión (`/admin`)

## Contexto

Sin cuentas, nadie podía ver ni limpiar lo que había en la instancia: las salas abandonadas se
acumulaban, un equipo que perdía su enlace `/t/:slug?k=…` perdía sus barajas para siempre (ADR 0006
lo dejó fuera a propósito) y no había forma de renombrar un equipo ni de borrar una baraja sin su
token. Hace falta un panel para quien administra la instancia: listar y borrar salas; listar,
renombrar, regenerar el enlace y borrar equipos; y listar y borrar barajas personalizadas.

## Decisión

- **Una sola cuenta de administración, configurada por entorno, sin tabla de usuarios.**
  `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (validados en `config/env.ts`). Son opcionales pero van
  juntos: sin ellos el panel no existe y `/api/admin/*` responde 503 con el motivo, para no romper
  despliegues que aún no los tengan. Un sistema de usuarios sería el F15 de la v2
  (`docs/01-especificacion.md`), no esto.
- **La contraseña nunca está en claro en la configuración.** `ADMIN_PASSWORD_HASH` es scrypt con sal
  aleatoria (`node:crypto`, sin dependencias nuevas), generado con
  `pnpm --filter @pp/api admin:hash-password`. Formato `scrypt:<sal>:<hash>` en base64url: sin `$`,
  que docker compose interpretaría como interpolación. La comparación es de tiempo constante y
  deriva la contraseña aunque el usuario no coincida, para no filtrar cuál de los dos falla.
- **Sesión sin estado en `Authorization: Bearer`, no cookie.** El token es `<expiraMs>.<HMAC>`,
  válido 8 horas. API (Render) y front (Cloudflare) viven en orígenes distintos: una cookie exigiría
  `SameSite=None`, `credentials` en CORS y defensa CSRF; un Bearer no se envía solo. La clave del
  HMAC es `SESSION_SECRET` + el hash de la contraseña, así que cambiar la contraseña invalida todas
  las sesiones sin necesidad de guardarlas. El front guarda la sesión en `sessionStorage`: muere con
  la pestaña.
- **Freno a la fuerza bruta en memoria**: 5 fallos por IP en 15 minutos bloquean esa IP (429).
  Mismo criterio que `GameVersionTracker`: con una sola instancia no hace falta más.
- **Autenticación y casos de uso separados.** `LogInAdmin` usa dos puertos (`AdminCredentials`,
  `AdminSessions`); el resto de casos de uso (`ListGamesForAdmin`, `DeleteGame`,
  `ListTeamsForAdmin`, `RenameTeam`, `RegenerateTeamToken`, `DeleteTeam`, `ListDecksForAdmin`,
  `DeleteDeckAsAdmin`) no saben nada de sesiones: la comprobación del Bearer es un hook de Fastify
  encapsulado en `infrastructure/http/routes/admin.ts`, igual que `requireToken` en `teams.ts`.
- **Listado de salas por proyección, no cargando agregados.** `GameRepository.listSummaries()`
  devuelve `GameSummary` (conteos de participantes, tareas y tareas estimadas, fecha de creación):
  cargar cada `Game` con rondas y votos solo para contar filas no escala. Los repositorios ganan
  además `delete`, `findById`/`listAll` (equipos) y `listCustom`/`deleteOwnedBy` (barajas), todos
  cubiertos por la suite de contrato contra memoria y Postgres.
- **Reglas en el dominio.** `Team.rename()` conserva el slug (los enlaces repartidos siguen
  valiendo); `Team.rotateToken()` sustituye el hash y el enlace anterior deja de resolver al
  persistirse. `SavedDeck.assertDeletable()` impide borrar las dos barajas de sistema
  (`SystemDeckNotDeletableError`, 422): tienen ID fijo sembrado por migración y `CreateGame` depende
  de ellas.
- **Borrar un equipo borra sus barajas pero no sus salas.** Postgres ya lo hace por FK
  (`decks` en cascada, `games.team_id` a null — ADR 0006), pero `DeleteTeam` llama también a
  `DeckRepository.deleteOwnedBy` para que el resultado no dependa de que el adaptador tenga claves
  foráneas.
- **Borrar una sala avisa a quien esté sentado.** `RealtimeBroadcaster.closeGame()` emite el
  `EphemeralEvent` `game_closed` a la room y la vacía; el `gameStore` del front deja la mesa sin
  partida con el mensaje "la ha cerrado un administrador". Es efímero y sin `version`: no hay estado
  que sincronizar después.

## Fuera de alcance (deliberado)

- Varios administradores, roles o auditoría de acciones: una sola cuenta cubre el caso real.
- Editar el contenido de salas (tareas, participantes) o de barajas desde el panel: el facilitador
  y la página del equipo ya lo hacen.
- Borrado automático de salas antiguas: con el listado ordenado por fecha el borrado manual basta.

## Consecuencias

- `packages/contracts` gana `AdminSessionView`, `AdminGameView`, `AdminTeamView`, `AdminDeckView`,
  `AdminTeamTokenView`, `adminLoginCommandSchema`, `renameTeamCommandSchema` y el `EphemeralEvent`
  `game_closed`.
- Render necesita dos variables nuevas para activar el panel (`docs/06-despliegue.md` §4);
  `docker-compose.yml` y `.env.example` traen credenciales de desarrollo (`admin` /
  `admin-dev-change-me`).
- `test:unit` incluye ahora `tests/infrastructure/` (scrypt, sesiones, throttle, validación de
  entorno), que no necesitan ni BD ni red.
- La página `/admin` (`features/admin/`) se compone con piezas de `design-system/` (`Tabs`, `Modal`,
  `Input`, `Button`) sin handoff de diseño propio, igual que las pantallas de equipo del bloque 7.
