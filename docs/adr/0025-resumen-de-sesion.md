# 0025 — Resumen de sesión

_Borrador escrito al planificar el bloque 17 (`docs/07-plan-v2.md` §9). Actualizar en la PR del
bloque si la implementación se desvía._

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
- **Totales según la baraja**: suma de las estimaciones numéricas; con barajas no numéricas
  (tallas), recuento por valor. `?` y `☕` no cuentan en ningún caso.
- La duración por tarea va de la primera ronda abierta a la estimación final; es `null` si falta
  cualquiera de los dos (partidas anteriores a la migración `0008`).

## Consecuencias

- Cualquiera con el enlace de la partida puede ver su resumen, igual que la partida.
- Depende de los tiempos del bloque 16; en partidas antiguas se muestra sin duraciones.
