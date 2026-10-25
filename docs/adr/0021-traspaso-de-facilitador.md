# 0021 — Traspaso de facilitador

_Borrador escrito al planificar el bloque 13 (`docs/07-plan-v2.md` §5). Actualizar en la PR del
bloque si la implementación se desvía._

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

## Consecuencias

- Sin migración: `participants.is_facilitator` ya existe y `save()` lo reescribe.
- Sin cuentas no hay forma de distinguir a un facilitador legítimo que vuelve: si alguien tomó el
  relevo, el anterior vuelve como participante normal. Es el comportamiento esperado.
- `namedRevealers` no se toca al traspasar.
