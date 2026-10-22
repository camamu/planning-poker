# 0018 — Cualquiera cambia la baraja y los emojis vienen activados

## Contexto

`ADR 0014` dejó el cambio de baraja en sala solo para el facilitador, con el mismo criterio que
`updateSettings`. En la práctica el equipo quiere que cualquiera pueda proponer pasar a tallas (o
volver a Fibonacci) sin depender de quien creó la sala. Por otro lado, lanzar emojis empezaba
desactivado y casi nadie lo encendía, aunque es lo que da vida a la mesa.

## Decisión

- **`Game.changeDeck` acepta a cualquier participante**, espectadores incluidos: solo exige que
  exista en la partida. Se borra `DeckChangeNotAllowedError`. Se mantiene la regla de no cambiar con
  una ronda `OPEN` (`DeckChangeDuringVotingError`) y la disponibilidad de la baraja por equipo.
- **El resto de ajustes sigue siendo del facilitador.** En el front el botón «Ajustes» se ve para
  todos; quien no es facilitador solo ve el `GameDeckPicker` del panel, sin `GameSettingsForm` ni el
  acceso al editor de barajas del equipo.
- **`throwEmojis` pasa a `true` por defecto** en `GameSettings.of`, en `gameSettingsSchema`
  (`packages/contracts`) y en `DEFAULT_SETTINGS` del formulario de creación. Las partidas ya creadas
  conservan su valor guardado; la columna `throw_emojis` no se migra porque el mapper siempre la
  escribe explícitamente.

## Consecuencias

- Revisa la regla de permisos de `ADR 0014`; el resto de ese ADR sigue vigente.
- Cualquiera de la sala puede cambiar la baraja entre rondas sin aviso previo; el evento
  `deck_changed` ya lo refleja en vivo para todos.
