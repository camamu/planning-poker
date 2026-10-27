# 0024 — Tiempos de ronda e histórico de partidas

_Borrador escrito al planificar el bloque 16 (`docs/07-plan-v2.md` §8). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

`02-decisiones-y-plan.md` §6 dejó el histórico fuera de la v1 notando que los datos ya estaban en
la BD (tabla `rounds`, que el plan llamaba `voting_rounds`) y solo faltaba la vista. Faltan también
dos datos para saber cuánto llevó cada tarea: cuándo se abrió una ronda (solo se guarda
`revealed_at`) y cuándo se estimó la tarea.

## Decisión

- **`Round.openedAt` e `Issue.estimatedAt`**, fijados por el dominio con el `now` que ya reciben
  `startVotingRound` y `setFinalEstimate`. Migración `0008`, columnas nulas: las rondas y tareas
  anteriores quedan con tiempos desconocidos en vez de inventados.
- **Puerto de consulta `GameHistoryReader`**, separado de `GameRepository`. Listar partidas no es
  una operación sobre un agregado: reconstruir cada `Game` con todas sus rondas y votos para
  mostrar un nombre y dos contadores sería caro y no aporta invariantes. Implementación Postgres con
  una consulta agregada e in-memory para tests, con suite de contrato común.
- **El histórico es del equipo**: `GET /api/teams/:slug/games?k=<token>`, con el mismo token que la
  página del equipo. Las partidas sin equipo no tienen dueño y el servidor no puede listarlas sin
  exponer las de todo el mundo (mismo razonamiento que `rememberedTeams.ts`); en su lugar, la portada
  recuerda las partidas visitadas en `localStorage`.
- Paginación por fecha (`before`), no por desplazamiento: las partidas nuevas no desplazan páginas.

## Consecuencias

- Los mappers de rondas e issues escriben los campos nuevos siempre; si no, el siguiente `save()`
  los borraría.
- `GameHistoryReader` es el primer puerto solo de lectura; si aparecen más consultas así, se
  agrupan en `application/queries/`.
- `/api/teams/:slug/games` lee de `games.team_id`, que ya existe desde `0004`.
