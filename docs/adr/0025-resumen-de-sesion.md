# 0025 — Resumen de sesión

_Implementado en el bloque 17 (`docs/07-plan-v2.md` §9)._

## Contexto

Al acabar una planificación el equipo quiere saber cuánto suma el sprint, qué tareas no tuvieron
consenso y en cuáles se fue el tiempo. Hoy hay que repasar la lista de tareas una a una.

## Decisión

- **`toGameSummaryView(game)`**, función pura en `application/read-models/` sobre el agregado ya
  cargado, expuesta en `GET /api/games/:id/summary`. A diferencia del histórico (ADR 0024), aquí sí
  hace falta el agregado entero: el resumen recorre rondas y votos de una sola partida.
- **Solo agregados, sin votos individuales.** El resumen se comparte fuera de la sala (se exporta en
  el bloque 18) y no debe servir para señalar a quién votó qué. Los votos individuales siguen
  visibles en la sala tras cada revelado, como hasta ahora.
- **Solo rondas reveladas.** Una ronda abierta no aporta nada al resumen, así que la invariante 7
  no corre riesgo.
- **Totales según el valor de la estimación, no según la baraja**: `points` suma las estimaciones
  numéricas (`null` si ninguna lo es) y `nonNumericEstimates` cuenta por valor las demás (tallas).
  La baraja se puede cambiar en sala (ADR 0014), así que una misma partida puede tener estimaciones
  de las dos clases y el resumen enseña las dos. `?` y `☕` no cuentan en ninguna.
- **Qué es «sin estimar»**: `pendingCount` agrupa las tareas pendientes y las que se dejaron en
  votación sin estimar; `estimatedCount` solo las que tienen estimación final. Una tarea con más
  de una ronda revelada cuenta en `multiRoundCount` esté o no estimada.
- **Consenso total**: tareas estimadas cuya última ronda revelada terminó en unanimidad
  (`RoundResult.isUnanimous`). El acuerdo y la media de cada tarea son los de esa última ronda.
- **Votantes distintos**: participantes con voto en alguna ronda revelada. Es un recuento; el
  servidor no devuelve quién es.
- La duración por tarea va de la primera ronda abierta a la estimación final; es `null` si falta
  cualquiera de los dos (partidas anteriores a la migración `0008`).

## Interfaz

- Ruta `/games/:gameId/summary`, sin identidad de participante: la ve quien tenga el enlace.
- Se abre **en otra pestaña** desde la `TopBar` («Resumen») y desde el panel de resultados.
  Navegar en la misma pestaña desconectaría el socket de la sala: el resto te vería ausente y, si
  eres el facilitador, se ofrecería tomar tu relevo (ADR 0021). Desde el histórico del equipo, que
  no está en una sala, se navega en la misma pestaña.
- El panel de resultados ofrece «Ver resumen de la sesión» cuando no quedan tareas pendientes y la
  tarea de la ronda actual ya está estimada (`isSessionFinished`). Se decide con el estado de las
  tareas y no con el de la ronda porque el cliente no recibe el cierre de la ronda.
- Se resaltan las tareas con acuerdo menor del 50 % en su última ronda o con más de una ronda
  revelada, con una etiqueta de texto además del color.

## Consecuencias

- Cualquiera con el enlace de la partida puede ver su resumen, igual que la partida.
- Depende de los tiempos del bloque 16; en partidas antiguas se muestra sin duraciones.
- Es una lectura sobre el agregado entero y no se cachea: partidas muy largas la harán más lenta,
  pero la sala ya carga el mismo agregado en cada acción.
- El bloque 18 exporta este mismo `GameSummaryView` en el cliente; no hace falta otra ruta.
