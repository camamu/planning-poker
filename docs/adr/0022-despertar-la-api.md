# 0022 — Despertar la API desde el cliente

_Escrito al planificar el bloque 14 (`docs/07-plan-v2.md` §6) y ajustado al implementarlo; las
diferencias con el borrador están en «Desviaciones»._

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

## Implementación

- **`shared/api/serverWarmup.ts`**: `createServerWarmup({ healthUrl, fetch, onStatus })` es una
  máquina de estados sin React ni store. Cada intento es un `GET /health` con `AbortController` a
  5 s; entre intentos espera 1, 2, 4 y luego 5 s; a los 90 s desde el primer intento da la API por
  inalcanzable. Cualquier respuesta no 2xx (el proxy de Render devuelve 502/503 mientras arranca) o
  fallo de red cuenta como «aún no» y se reintenta.
- **`shared/store/serverStatusStore.ts`**: `serverStatus` (`checking` → `waking` → `ready` |
  `unreachable`) con `start()` y `retry()`; `main.tsx` llama a `start()` una vez antes de montar React
  (fuera del ciclo de vida de los componentes, para que `StrictMode` no lo duplique). A los 2 s sin
  respuesta pasa a `waking`.
- **`design-system/components/Banner`**: componente puro con `message`, `variant` (`info` | `error`)
  y una `action` opcional. No sabe nada del servidor.
- **`features/server-status`**: `ServerWakeBanner` (montado en `App`) traduce el estado a texto y
  variante, y `ServerNotReadyNote` da, bajo cada botón deshabilitado, el motivo.
- **Qué espera a `ready`**: los botones de crear partida, unirse y crear equipo, y las peticiones que
  esas pantallas hacen al cargar (barajas en `CreateGamePage`, `authenticateTeam` en `TeamPage`).
  Sin esto, una API dormida las convertía en errores en pantalla en vez de en espera.
- **`warmup.yml`**: `workflow_dispatch` con `curl` a `/health` y reintentos hasta 3 min, y un
  `schedule` comentado de ejemplo. Usa la variable `API_HOST` que ya tiene `deploy.yml`.

## Desviaciones respecto al borrador

- **El banner flota** (`position: fixed`, arriba y centrado) en vez de ir en el flujo: la mesa ocupa
  `h-screen` y una barra en flujo la haría desbordar. Solo se ve en `waking` y `unreachable`.
- **`retry()` entra directamente en `waking`**, sin volver a «comprobando» dos segundos: quien pulsa
  «Reintentar» ya sabe que el servidor está dormido y el banner no debe desaparecer y reaparecer.
- **El socket de la mesa no espera a `ready`.** Socket.IO ya reintenta la conexión por sí solo con
  espera creciente, y al conectar vuelve a emitir `join`; entrar a una sala con la API dormida
  muestra «Conectando con la mesa…» junto al banner y se rellena sola al despertar. Bloquear
  `connect()` solo duplicaría ese mecanismo. Unirse por primera vez sí espera, porque es un `POST`.
- **El panel `/admin` queda fuera**: no está en el alcance del bloque y quien lo usa es la persona
  que mantiene la app, no el equipo en una planificación.
- **Bloque 21.** La página principal pide calentar «en silencio, sin banner»; el calentamiento ya es
  global y arranca al cargar cualquier ruta, así que el bloque 21 solo tendrá que ocultar el banner
  en `/` (por ejemplo, comprobando la ruta en `ServerWakeBanner`), no volver a lanzar nada.
