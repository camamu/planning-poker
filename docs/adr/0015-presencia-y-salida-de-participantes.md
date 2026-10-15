# 0015 — Presencia y salida de participantes

## Contexto

Entrar en una partida crea un `Participant` persistente y no había forma de dejar de serlo: cerrar
la pestaña, perder la red o reiniciar la API no cambiaba nada. Quien entraba desde otro navegador
(la identidad vive en `localStorage`) dejaba además un duplicado huérfano. Los "fantasmas" no eran
solo ruido visual: el auto-revelado esperaba el voto de todos los `VOTER` y con uno desconectado la
ronda no se revelaba nunca, aunque la invariante 8 habla de los votantes _presentes_.

## Decisión

- **Salir / quitar (baja lógica).** `Game.removeParticipant(target, requestedBy, now)`: puede salir
  uno mismo o quitar el facilitador (`ParticipantRemovalNotAllowedError` en otro caso), y el
  facilitador no puede salir (`FacilitatorCannotLeaveError`): sin él nadie toca ajustes ni baraja.
  No se borra la fila: los votos de rondas ya reveladas apuntan al participante y su resultado es
  histórico, y `PostgresGameRepository.save()` reescribe el agregado entero. Migración
  `0006_participants_left` (`participants.left`). Su voto en la ronda _abierta_ se retira. Quien ha
  salido no puede actuar (`requireParticipant` lo trata como inexistente) y su `join` por socket
  recibe `left_game`.
- **Presencia efímera, fuera del dominio.** `PresenceTracker` (infraestructura, en memoria, como
  `GameVersionTracker`) cuenta los sockets unidos por participante. Perder el último socket no
  desconecta: hay **30 s de gracia** para cortes breves y pestañas dormidas. Puerto de lectura
  `PresenceReader` en `application/ports`; el dominio recibe el resultado como un dato más
  (`castVote(..., present?)`, `reconcileAutoReveal`, `removeParticipant(..., present?)`), nunca el
  seguimiento en sí.
- **Auto-revelado con presentes (invariante 8).** Cuenta solo a los `VOTER` conectados; quien acaba
  de votar cuenta como presente aunque su socket esté a medio reconectar. El nuevo caso de uso
  `ReconcileAutoReveal` se dispara al pasar alguien a desconectado, por si era el último que
  faltaba. No revela una ronda sin ningún voto.
- **Arranque en frío.** Durante los primeros 30 s tras arrancar la API `votingPresence` devuelve
  `undefined` (= cuenta todo el mundo): tras un despliegue o un spin-down de Render los clientes
  tardan unos segundos en reconectar y el primero en votar no debe revelar solo con su voto.
- **Contratos.** `ParticipantView.online`; `ServerEvent` `participant_left` (versionado; el cliente
  resincroniza, porque cambia el dealer); `EphemeralEvent` `presence_changed` y `left_game`.
  `DELETE /api/games/:id/participants/:participantId` (`{ participantId }` = quien lo pide → 204).
- **Front.** Asientos de desconectados atenuados, ✕ para el facilitador, "Salir" para el resto, y
  "x de y han votado" cuenta solo a los conectados. Quien sale o es quitado ve una pantalla con
  "Volver a entrar" (borra la identidad guardada).

## Consecuencias

- Los fantasmas desaparecen a mano (✕) o dejan de bloquear el auto-revelado al pasar los 30 s.
  Un participante desconectado sigue en la lista, atenuado, hasta que alguien lo quita.
- Si todos los demás se caen más de 30 s, quien sigue conectado puede revelar solo con su voto; es
  el mismo comportamiento que una partida de una sola persona.
- La presencia no se persiste y no sobrevive a un reinicio: se reconstruye cuando los clientes
  reconectan (necesita que el cliente vuelva a emitir `join` en cada `connect`).
- Quien entra desde otro dispositivo sigue creando un participante nuevo; recuperar identidad por
  nombre queda fuera de este ADR.
