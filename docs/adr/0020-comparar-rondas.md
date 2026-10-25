# 0020 — Comparar rondas de la misma tarea

_Borrador escrito al planificar el bloque 12 (`docs/07-plan-v2.md` §4). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

«Volver a votar» abre una ronda nueva sobre la misma tarea y la anterior queda guardada, pero
`GameView` solo expone `currentRound`. Después de discutir, lo interesante es ver si el equipo se
acercó: cómo cambió la distribución y quién movió su voto. Hoy hay que recordarlo de memoria.

## Decisión

- **`RoundView.previousRounds`**: las rondas reveladas o cerradas de la misma tarea, anteriores a
  la actual, con sus votos y su resultado. Se calcula en `toGameView` a partir de un accesor de
  lectura nuevo, `Game.roundsOf(issueId)`.
- **Hereda la invariante 7.** Es una segunda vía por la que pueden salir votos del servidor, así que
  `toGameView` filtra por `isRevealed()` antes de leerlos y un test e2e lo fija con una ronda 2
  abierta.
- **Sin cambios en el dominio ni en la BD.** Las rondas y sus votos ya se persisten.
- Viaja en `state_sync`, no en un evento nuevo: `round_started` ya provoca `resync` y las rondas
  anteriores no cambian.

## Consecuencias

- `state_sync` crece con los votos de las rondas anteriores de la tarea actual; con un equipo
  pequeño y pocas repeticiones es despreciable.
- La comparación solo cubre la tarea actual. El histórico completo es cosa del bloque 16.
