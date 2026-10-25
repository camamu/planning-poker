# 0022 — Despertar la API desde el cliente

_Borrador escrito al planificar el bloque 14 (`docs/07-plan-v2.md` §6). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

Render free duerme la API tras un rato sin tráfico y el primer request tarda en despertarla.
`06-despliegue.md` §2.2 aceptó la mitigación «abrir el enlace un par de minutos antes» y descartó un
ping permanente por consumir cupo sin necesidad. En la práctica, quien abre el enlace ve una pantalla
que no responde y lo interpreta como un fallo.

## Decisión

- **El cliente despierta la API al cargar**: `GET /health` con reintentos y espera creciente hasta
  unos 90 s, y un estado `serverStatus` en `shared/`.
- **Se explica en pantalla**: si no hay respuesta en 2 s, banner «Despertando el servidor…»; los
  botones que necesitan la API se deshabilitan con el motivo hasta que responde.
- **No hay ping permanente.** Se mantiene la decisión de `06-despliegue.md` §2.2: la API solo se
  despierta cuando alguien la va a usar.
- **Workflow de calentamiento opcional** (`warmup.yml`, `workflow_dispatch` y un `schedule`
  comentado). Activarlo para el día de la planificación es una decisión del equipo; no consume más
  que una apertura manual.

## Consecuencias

- Mejora la percepción, no el tiempo real de arranque. Si la espera llega a molestar de verdad, la
  salida sigue siendo la de §2.2: plan de pago o VPS.
- El banner es un componente puro en `design-system/`; la lógica de reintentos queda en `shared/` y
  se testea con reloj y `fetch` falsos.
