# 0020 — Comparar rondas de la misma tarea

_Implementado en el bloque 12 (`docs/07-plan-v2.md` §4). Desviaciones respecto al borrador, abajo._

## Contexto

«Volver a votar» abre una ronda nueva sobre la misma tarea y la anterior queda guardada, pero
`GameView` solo expone `currentRound`. Después de discutir, lo interesante es ver si el equipo se
acercó: cómo cambió la distribución y quién movió su voto. Hoy hay que recordarlo de memoria.

## Decisión

- **`RoundView.previousRounds`**: las rondas reveladas o cerradas de la misma tarea, anteriores a
  la actual, con sus votos y su resultado (`PastRoundView`). Se calcula en `toGameView` a partir de
  un accesor de lectura nuevo, `Game.roundsOf(issueId)`.
- **Hereda la invariante 7.** Es una segunda vía por la que pueden salir votos del servidor, así que
  `toGameView` filtra por `isRevealed()` antes de leerlos. Además lee los votos con
  `Round.revealedVotes()` y no con `allVotesRaw()`: aunque `roundsOf` o el filtro fallaran, el
  dominio lanza `RoundNotRevealedError` en vez de entregar una carta. Dos tests lo fijan: el de
  `use-cases` con una ronda 2 abierta (y otra anterior sin revelar, reconstruida a mano) y el e2e
  del `state_sync` crudo.
- **Sin cambios en el dominio ni en la BD.** Las rondas y sus votos ya se persisten.
- Viaja en `state_sync`, no en un evento nuevo: `round_started` ya provoca `resync` y las rondas
  anteriores no cambian mientras dura la actual. `round_revealed` solo parchea la ronda actual y
  conserva `previousRounds`, así que al revelar la segunda ronda la comparación aparece sola.
- **El front compara con la ronda inmediatamente anterior** (`previousRounds.at(-1)`), aunque el
  contrato lleve todas. Con tres o más rondas, comparar la 3 con la 2 responde a «¿nos hemos
  acercado tras la última discusión?»; elegir contra cuál comparar queda para quien lo pida.
- **«Quién cambió su voto»** es quien votó en las dos rondas y con otra carta. Quien votó en una
  sola no cuenta: comparar un voto con una ausencia no dice nada a la mesa. Si el
  `participantId` ya no está en `participants` (salió después de votar), se nombra «Alguien que ya
  no está».

## Desviaciones respecto al borrador

- **La comparación sustituye al bloque «Distribución»** en vez de añadirse a él: muestra las dos
  distribuciones (ronda anterior y actual, con `DistributionBar`) en una sola sección. Duplicar la
  actual encima de la comparación gastaba espacio en un panel estrecho. Sin ronda anterior el panel
  queda como estaba.
- **`ResultsPanel` recibe `participants`** para nombrar a quien cambió el voto; `RoundView` solo
  lleva ids.

## Consecuencias

- `state_sync` crece con los votos de las rondas anteriores de la tarea actual; con un equipo
  pequeño y pocas repeticiones es despreciable.
- La comparación solo cubre la tarea actual. El histórico completo es cosa del bloque 16.
- Una tarea ya estimada que se vuelve a votar enseña también la ronda cerrada por la estimación
  (`CLOSED` cuenta como revelada).
