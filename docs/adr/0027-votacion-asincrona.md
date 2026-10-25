# 0027 — Votación asíncrona

_Borrador escrito al planificar el bloque 19 (`docs/07-plan-v2.md` §11). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

F2 de `01-especificacion.md`: abrir tareas para que cada uno vote cuando pueda y revelarlas en lote.
`02-decisiones-y-plan.md` §6 lo anticipaba como «un `RoundStatus` extra y un reveal en lote». El
agregado asume hoy una sola ronda abierta (`AnotherRoundOpenError`) y que la ronda actual es la
última de la lista (`currentRound()`), y de eso dependen el auto-revelado, la cuenta atrás y el
dealer.

## Decisión

- **Un modo, no un estado**: `Round.mode: 'LIVE' | 'ASYNC'`. Una ronda asíncrona pasa por los
  mismos estados (`OPEN` → `REVEALED` → `CLOSED`); lo distinto es que varias pueden estar abiertas
  a la vez y conviven con la mesa en vivo. Un estado extra habría obligado a duplicar en cada
  comprobación «abierta o abierta-asíncrona».
- **`openRound()` y `currentRound()` solo miran rondas `LIVE`.** Todo lo que depende de ellas sigue
  igual, y el resto de reglas no necesitan saber que existe la votación asíncrona.
- **Las reglas de voto se reutilizan** (espectador, carta en baraja, `allowVoteChange`); lo único
  que no aplica es el auto-revelado ni la cuenta atrás. Revelar en lote exige `canReveal`, mismo
  permiso que el revelado en vivo.
- **Pasar una tarea a la mesa absorbe su ronda asíncrona**: la ronda en vivo arranca con sus votos.
  Quien votó en diferido no repite, y no quedan dos rondas abiertas para la misma tarea.
- **`setFinalEstimate` acepta `issueId`** para cerrar tareas reveladas en lote sin tener que
  convertirlas en la ronda actual.
- **La baraja no cambia con rondas asíncronas abiertas**, por el motivo de `ADR 0014`.
- **Invariante 7**: `GameView.asyncRounds` solo lleva quién ha votado y la carta propia del viewer
  hasta el revelado. Test e2e obligatorio.

## Consecuencias

- Migración `0009`: `rounds.mode text not null default 'LIVE'`; las rondas existentes son en vivo.
- La issue sigue `PENDING` mientras su ronda asíncrona está abierta; el front la distingue por
  `asyncRounds`. No se añade un `IssueStatus` nuevo.
- No hay avisos fuera de la app (correo, Slack) para recordar que hay votos pendientes: fuera de
  alcance, cada uno entra por el enlace.
