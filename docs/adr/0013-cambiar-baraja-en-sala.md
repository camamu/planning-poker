# 0013 — Cambiar de baraja dentro de una sala

## Contexto

La baraja se elegía solo al crear la partida y `Game.deck` era inmutable. Si el equipo se daba
cuenta a mitad de sesión de que necesitaba tallas en vez de Fibonacci (o al revés), la única salida
era crear otra sala y perder participantes, cola de tareas e histórico de estimaciones.

## Decisión

- **`Game.changeDeck(deck, requestedBy, now)`** sustituye la baraja y emite `GameDeckChanged`.
  Solo el facilitador puede (`DeckChangeNotAllowedError`), mismo criterio que `updateSettings`.
- **Solo entre rondas.** Con una ronda `OPEN` lanza `DeckChangeDuringVotingError`: sus votos podrían
  no existir en la baraja nueva y quedaría una ronda con cartas que nadie puede volver a elegir.
  Descartamos borrar votos en silencio (destructivo, y el resto de la sala no se entera de por qué).
  Con la ronda `REVEALED` sí se permite: su resultado es histórico y no se revalida contra la
  baraja; la estimación final sí se elige de la baraja nueva (`setFinalEstimate` ya lo exige).
- **Los votos y estimaciones ya guardados no se migran.** Una issue estimada con `13` conserva ese
  valor aunque la baraja pase a tallas.
- **`ChangeGameDeck` (caso de uso)** resuelve el `SavedDeck` por id y comprueba
  `SavedDeck.assertAvailableTo(game.currentTeamId())`: una baraja de sistema vale siempre; una
  personalizada solo si es del equipo de la partida (`DeckNotAvailableError`). La regla vive en el
  dominio; el caso de uso solo la invoca. Nota: `CreateGame` sigue sin esta comprobación
  (`ADR 0006`); no se ha tocado para no ampliar el alcance.
- **HTTP**: `PATCH /api/games/:id/deck` (`{ participantId, deckId }` → 204) y
  `GET /api/games/:id/decks` para listar las barajas disponibles _para esa partida_, porque
  `GameView` no expone el slug del equipo y el cliente no puede usar `GET /api/decks`.
- **Tiempo real**: nuevo `ServerEvent` `deck_changed` con las cartas nuevas. Lleva datos suficientes
  para parchear (a diferencia de `round_started`), así que `gameEventsReducer` lo aplica sin
  resync. El store limpia además `selectedCard`, que puede no existir en la baraja nueva.
- **Persistencia**: sin migración. `games.deck` ya existía y `PostgresGameRepository.save` ya lo
  incluía en el `doUpdateSet`; ahora hay un test de contrato que lo fija.
- **Frontend**: `GameDeckPicker` dentro de `DeckSettingsPanel` (solo lo ve el facilitador). Aplica
  al elegir, sin botón de guardar, y se deshabilita con aviso mientras hay una ronda abierta. La
  baraja activa se reconoce por igualdad de cartas, porque la partida guarda una copia y no el id.

## Consecuencias

- `packages/contracts` gana `changeGameDeckCommandSchema` y el evento `deck_changed`.
- `GameRoutesDependencies` gana `changeGameDeck` y `listGameDecks`; `main.ts` y
  `tests/e2e/support/testServer.ts` quedan cableados igual.
- Si una baraja de equipo se edita después de crear la partida, ninguna opción aparece marcada como
  activa en el selector hasta que se vuelva a elegir una.
