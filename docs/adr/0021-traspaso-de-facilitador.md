# 0021 — Traspaso de facilitador

_Escrito al planificar el bloque 13 (`docs/07-plan-v2.md` §5) y ajustado al implementarlo; las
diferencias con el borrador están en «Desviaciones»._

## Contexto

`isFacilitator` se fija al crear la partida y no cambia. Si el facilitador cierra la pestaña, nadie
puede tocar ajustes ni, con `FACILITATOR_ONLY`, revelar. `ADR 0015` impide además que salga
(`FacilitatorCannotLeaveError`) justo para no dejar la sala sin facilitador, pero eso no evita que
simplemente desaparezca. F11 ya contemplaba el traspaso sin recrear la partida.

## Decisión

- **Ceder**: `Game.transferFacilitator(toId, requestedBy, now)`, solo el facilitador actual. Sigue
  habiendo exactamente un facilitador.
- **Tomar el relevo**: `Game.claimFacilitator(requestedBy, now, present)`, cualquiera, solo si el
  facilitador no está en `present`. La presencia sigue fuera del dominio (`ADR 0015`): el caso de
  uso la lee de `PresenceReader.votingPresence` y el dominio la recibe como dato. Con presencia
  desconocida (API recién arrancada) se rechaza, para no quitarle el rol a alguien que solo está
  reconectando. La gracia de 30 s del `PresenceTracker` ya cubre los cortes breves.
- **Salir siendo facilitador** sigue prohibido; el front ofrece ceder y salir en un solo diálogo.
  Así el dominio no necesita un «sucesor automático» con reglas de elección.
- `Participant.isFacilitator` pasa a getter sobre estado privado para no tocar los usos existentes.
- REST (`POST /api/games/:id/facilitator` y `/facilitator/claim`), como los demás cambios de
  configuración de la sala. Evento `facilitator_changed`, parcheable.

## Implementación

- **Dominio**: `Participant.isFacilitator` es un getter sobre estado privado, con `promote()` y
  `demote()`. `Game.transferFacilitator` y `Game.claimFacilitator` comparten un único paso privado
  que baja a uno, sube al otro y registra `FacilitatorChanged { previousId, nextId }`, así que
  siempre hay exactamente un facilitador.
- **Aplicación**: `TransferFacilitator` y `ClaimFacilitator` (este último con `PresenceReader`,
  igual que `RemoveParticipant`). La presencia que decide el relevo es `votingPresence`, la misma
  que el auto-revelado: ya incluye la gracia de 30 s y vale `undefined` durante el arranque en frío.
- **Transporte**: `POST /api/games/:id/facilitator` y `POST /api/games/:id/facilitator/claim`
  (204; las reglas incumplidas son 422). `facilitator_changed` lleva los dos ids y el cliente solo
  mueve `isFacilitator` de uno a otro, sin `resync`.
- **Front**: el facilitador ve en cada asiento (y entre los espectadores) un botón 🔑 «Hacer
  facilitador a …» con confirmación; «Salir» abre un diálogo para elegir sucesor y ceder y salir en
  un solo gesto; el resto ve un banner «El facilitador no está conectado» con «Tomar el relevo»
  cuando su asiento aparece `online: false`.

## Desviaciones respecto al borrador

- **Presencia desconocida tiene su propio error.** El borrador la mezclaba con
  `FacilitatorStillPresentError`; «sigue conectado» y «aún no sé quién está» piden mensajes
  distintos al usuario (el segundo se resuelve esperando unos segundos), así que hay un
  `FacilitatorPresenceUnknownError` aparte. Ambos son 422.
- **Quien pide el relevo cuenta como presente**, igual que quien acaba de votar en `castVote`. Así
  el propio facilitador que intenta «tomar el relevo» recibe `FacilitatorStillPresentError` en vez
  de un no-op, aunque su socket esté a medio reconectar.
- **`GameWithoutFacilitatorError`** cubre una partida reconstituida sin facilitador. No debería
  existir (crear fija uno, ceder y tomar el relevo lo intercambian, salir lo prohíbe), pero
  `claimFacilitator` necesita saber a quién relevar y prefiere fallar a inventárselo.
- **El destino puede ser un espectador**, tanto al ceder como al tomar el relevo: el facilitador es
  un permiso, no un voto, y un moderador que no vota es un uso razonable.
- **Botón 🔑 en vez de menú de asiento**, y una corona 👑 que marca quién es el facilitador. Sin la
  marca nadie puede saber a quién se le ha cedido el rol; antes no hacía falta porque era siempre
  quien creaba la partida.
- **Un facilitador solo en la partida no puede salir**: «Salir» le abre un diálogo que lo explica,
  en vez de ocultar el botón.
- **El banner de relevo no se muestra con el socket propio caído**: la presencia que se ve está
  obsoleta y el servidor rechazaría el relevo o, peor, se pediría por un corte del propio usuario.
- Ningún evento nuevo lleva votos, así que no hace falta el e2e de la invariante 7; el e2e cubre
  ceder, el relevo tras desconectarse y los dos rechazos.

## Consecuencias

- Sin migración: `participants.is_facilitator` ya existe y `save()` lo reescribe.
- Sin cuentas no hay forma de distinguir a un facilitador legítimo que vuelve: si alguien tomó el
  relevo, el anterior vuelve como participante normal. Es el comportamiento esperado.
- `namedRevealers` no se toca al traspasar.
