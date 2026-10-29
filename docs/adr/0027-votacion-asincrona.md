# 0027 — Votación asíncrona

_Implementado en el bloque 19 (`docs/07-plan-v2.md` §11)._

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
- **Las reglas de voto se reutilizan** (espectador, carta en baraja, `allowVoteChange`): `castVote` y
  `castAsyncVote` comparten `requireVoteAllowed` y `placeVote`. Lo único que no aplica es el
  auto-revelado ni la cuenta atrás. Revelar en lote exige `canReveal`, mismo permiso que el revelado
  en vivo, con una salvedad (ver más abajo).
- **Pasar una tarea a la mesa absorbe su ronda asíncrona abierta**: la ronda en vivo arranca con sus
  votos (`Round.adoptVotesFrom`) y la asíncrona se retira. Quien votó en diferido no repite, y no
  quedan dos rondas abiertas para la misma tarea. Una ronda asíncrona **ya revelada** no se absorbe:
  volver a votar en vivo empieza una ronda nueva sin votos, y la revelada pasa a ser una ronda
  anterior más en la comparación del ADR 0020.
- **`setFinalEstimate` acepta `issueId`** para cerrar tareas reveladas en lote sin tener que
  convertirlas en la ronda actual.
- **La baraja no cambia con rondas asíncronas abiertas**, por el motivo de `ADR 0014`. Con rondas ya
  reveladas sí se puede, igual que con una ronda en vivo revelada.
- **Invariante 7**: `GameView.asyncRounds` solo lleva quién ha votado y la carta propia del viewer
  hasta el revelado. Test e2e obligatorio, que inspecciona los payloads crudos del socket de tres
  clientes y comprueba que ninguno recibe la carta de otro, tampoco en los `state_sync`.

### Lo que el plan no decía y se decidió al implementar

- **Con el reparto `DEALER` y sin ronda en vivo decide el facilitador.** El dealer sale de la ronda
  en vivo (`currentDealer()`); sin ella no designa a nadie y las rondas asíncronas no se podrían
  revelar ni estimar. `canRevealWithoutLiveRound` lo resuelve en el dominio y
  `canParticipantRevealAsync` lo replica en el cliente. Con una ronda en vivo abierta sigue mandando
  el dealer.
- **Absorber puede revelar al instante.** Si los votos en diferido ya completan la ronda y el
  auto-revelado está activo, `startVotingRound` revisa el auto-revelado como al votar (con la
  presencia que le pasa el caso de uso, igual que `CastVote`). Sin esto la ronda se revelaría sola en
  el siguiente cambio de presencia, sin que nadie hiciera nada. Una ronda sin votos no se revela.
- **Al salir un participante se retiran sus votos de todas las rondas abiertas**, también de las
  asíncronas (evento `VoteRetracted` con el id de esa ronda). Sus votos en rondas reveladas se
  conservan. El cliente ya resincroniza con `participant_left`, así que no necesita un evento propio.
- **Qué rondas ve la sala (`Game.activeAsyncRounds()`)**: las asíncronas que son la última ronda de
  su tarea y no están cerradas. Una tarea estimada o llevada a la mesa deja de aparecer.
- **Abrir en lote es todo o nada**: se validan todas antes de crear ninguna, y una tarea repetida en
  la lista falla igual que una ya abierta (`IssueNotPendingError`). Una lista vacía no hace nada.
- **Revelar es idempotente**: una tarea sin ronda asíncrona abierta (alguien se adelantó) o sin votos
  se ignora; una tarea que no existe lanza `IssueNotFoundError`. Si no queda nada, no emite evento.
- **Eventos del transporte**: `async_rounds_opened` y `async_rounds_revealed` solo llevan `issueIds`
  y piden `resync` (el estado de cada ronda es por viewer); `async_vote_cast` es un parche sin carta.
  `issue_estimated` retira del estado local la ronda en diferido de la tarea. Tope de 200 tareas por
  comando.
- **Duración en el resumen (ADR 0025)**: se cuenta desde la primera ronda **en vivo**. Contarla desde
  la apertura en diferido mediría días de espera, no el tiempo de mesa, y una tarea que solo se votó
  en diferido no tiene duración.
- **«Siguiente tarea» salta las tareas con ronda en diferido viva**: siguen `PENDING` en el dominio,
  pero se gestionan en su sección; saltar a una cuyo resultado espera aceptación la dejaría sin
  cerrar. `nextTableIssueId` lo calcula en el cliente.

## Interfaz

- **Panel de tareas**: casilla en cada tarea por estimar y «Abrir para votar en diferido (N)». Dos
  secciones nuevas: «Votando en diferido» (quién ha votado, «Votar», «Revelar» por tarea y «Revelar
  todas», y «Votar en vivo» si la mesa está libre) y «Resultados en diferido» (media, acuerdo,
  distribución, quién votó qué, selector de estimación con «Aceptar», y «Votar en vivo»).
- **Modal de voto**: la mano de cartas de la mesa, con la carta propia marcada. Si la partida no
  permite cambiar el voto y ya se votó, las cartas quedan bloqueadas.
- **Aviso en la barra**: el botón «Tareas» muestra cuántas rondas abiertas le faltan por votar al
  viewer, para no tener que abrir el panel para enterarse.
- El voto propio se pinta al momento (`asyncSelected` en el store) y se sustituye por el confirmado en
  el siguiente `state_sync`: `async_vote_cast` no reenvía la carta. Un error del servidor con votos
  pintados sin confirmar pide un `state_sync`, porque no dice cuál de los comandos rechazó.

## Consecuencias

- Migración `0009`: `rounds.mode text not null default 'LIVE'`; las rondas existentes son en vivo.
  Reversible; el contrato de repositorio fija que el modo, los votos y el orden de las rondas
  intercaladas sobreviven a `save` + `findById`, y que absorber una ronda la borra al guardar.
- La issue sigue `PENDING` mientras su ronda asíncrona está abierta; el front la distingue por
  `asyncRounds`. No se añade un `IssueStatus` nuevo.
- `Round.reconstitute` gana el modo como último parámetro obligatorio, para que un mapper que se
  olvide de él no pierda el dato en silencio.
- No hay avisos fuera de la app (correo, Slack) para recordar que hay votos pendientes: fuera de
  alcance, cada uno entra por el enlace. El aviso en la barra solo ayuda a quien ya está dentro.
- Una ronda asíncrona abierta no caduca: se queda abierta hasta que alguien la revele o la lleve a la
  mesa.
- El panel de resultados de la mesa en vivo enseña la media sin redondear (`8.666666666666666`);
  viene de antes de este bloque y no se ha tocado. La tarjeta en diferido la redondea a dos decimales
  con `formatPoints`.
