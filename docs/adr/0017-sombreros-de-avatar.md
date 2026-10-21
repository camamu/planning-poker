# 0017 — Sombreros de avatar

## Contexto

Los avatares de la mesa son caritas de color derivado del id, todas iguales salvo el tono. El
equipo quería poder personalizarlos con un sombrero (vaquero, mago, gorro de hélices…) y cambiarlo
en mitad de la sesión, viéndolo todos en vivo.

## Decisión

- **Dato del participante, persistido.** `Participant` gana `hat: Hat | null`. Se descartó tratarlo
  como `EphemeralEvent` (como los emojis): quien entra tarde o recarga no vería los sombreros de
  los demás, y eso sí se nota. Migración `0007_participants_hat` (`participants.hat`, `text null`).
- **Catálogo cerrado.** `Hat` es un value object con una lista fija de ids (`HAT_IDS`: `cowboy`,
  `wizard`, `propeller`, `crown`, `top-hat`, `party`, `pirate`, `viking`, `chef`). Cada sombrero
  está dibujado a mano en SVG en `design-system/components/Hat`, así que un id libre no tendría con
  qué pintarse. El catálogo se repite en el dominio y en `packages/contracts` (zod en el borde,
  `HatIdView` en la vista) porque el dominio no puede importar el paquete; `HAT_LABELS` es un
  `Record<HatIdView, …>`, así que añadir uno en contratos sin dibujarlo no compila.
- **`Game.changeParticipantHat(target, hat, requestedBy, now)`**: cada uno el suyo
  (`HatChangeNotAllowedError` si `requestedBy ≠ target`, ni siquiera el facilitador). Se permite
  con ronda abierta y a espectadores: es cosmético y no toca votos ni permisos. Emite
  `ParticipantHatChanged`.
- **Transporte.** `PATCH /api/games/:id/participants/:participantId/hat` (`{ participantId, hat }`
  → 204; `hat: null` para quitárselo). `ServerEvent` `participant_hat_changed`, versionado y con
  datos suficientes para que `gameEventsReducer` lo parchee sin resync.
- **Front.** `Avatar` acepta `hat` y lo dibuja sobresaliendo por arriba sin cambiar su tamaño; la
  fila del nombre en `ParticipantSeat` reserva ese hueco para no pisar la carta. `HatPicker` se
  abre desde "🎩 Sombrero" o el avatar de la barra superior, aplica al pulsar y queda abierto para
  probarse otro.

## Consecuencias

- `ParticipantView` gana `hat` (obligatorio, `null` sin sombrero).
- Un sombrero nuevo = id en `Hat.ts` + `HAT_IDS`/`HatIdView` en contratos + dibujo y etiqueta en
  `Hat.tsx`. No necesita migración.
