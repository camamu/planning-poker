# 0028 — Webhooks salientes en vez de integrar un gestor concreto

_Implementado en el bloque 20 (`docs/07-plan-v2.md` §12). La guía para quien configura el receptor
está en `docs/08-webhooks.md`._

## Contexto

Con la importación por URLs y CSV (ADR 0023) y la exportación (ADR 0026), llevar estimaciones al
gestor de tareas sigue siendo manual. `01-especificacion.md` situaba las integraciones en v3 (F18,
F19) por coste: cada gestor tiene su API, su autenticación y su forma de guardar los story points, y
habría que custodiar credenciales de terceros. Además el equipo no tiene por qué usar siempre el
mismo gestor.

## Decisión

- **La app no integra ningún gestor: envía webhooks.** Cada equipo configura hasta tres URLs y
  elige qué eventos recibe (`issue.estimated`, `issues.imported`, `session.summary`). El puente
  hacia el gestor lo pone el receptor: Jira Automation acepta webhooks entrantes y puede editar los
  story points, y n8n, Make, Zapier o una GitHub Action cubren el resto.
- **El webhook es del equipo** (`Team` en el dominio, tabla `team_webhooks`). Sin cuentas, el
  equipo es el único dueño posible; las partidas sin equipo no envían nada.
- **Sin credenciales de terceros.** Solo se guarda un secreto generado por la api para firmar con
  HMAC-SHA256 (`X-PP-Signature`), que se muestra una única vez. Se guarda en claro porque hace
  falta para firmar; es un secreto propio de la app, no una llave a otro sistema.
- **Cuerpo versionado y sin votos individuales.** `version: 1` permite evolucionar el formato; los
  votos quedan fuera por el mismo motivo que en el resumen (ADR 0025). Los esquemas viven en
  `packages/contracts/src/webhooks.ts` y un test de la api valida contra ellos todos los ejemplos de
  `docs/08-webhooks.md` y ejecuta su fragmento de verificación de la firma.
- **Entrega en segundo plano, que nunca bloquea la partida.** Un `CompositeEventPublisher` espera al
  publicador de tiempo real y reenvía los eventos de dominio a `DispatchWebhooks` sin esperarlo;
  sus errores van al log. Reintentos en memoria (3, con espera creciente) y aviso `webhook_failed` a
  la sala si se agotan. No hay outbox: una entrega en curso se pierde si la api se reinicia. Para
  una herramienta interna no compensa una cola persistente.
- **Protección SSRF obligatoria.** La api llama a URLs que introduce el usuario, así que solo
  `https`, sin seguir redirecciones, y rechazo de destinos que resuelven a direcciones privadas,
  loopback, link-local o de metadatos.
- `issueKeyFromUrl` pasa a `packages/contracts` para que la api pueda poner la `key` de la tarea
  (`ABC-123`) en el cuerpo, que es lo que necesita el receptor para encontrarla en su gestor.

### Lo que el plan no decía y se decidió al implementar

- **El sender usa `node:http(s)` y no `fetch`** (el plan decía `fetch` nativo). La protección SSRF
  tiene que estar en la conexión: el `lookup` valida todas las direcciones que devuelve el DNS y la
  conexión se abre a esa misma dirección. Con `fetch` solo se podía comprobar antes y volver a
  resolver después, y un nombre con TTL 0 que cambie de respuesta (DNS rebinding) se colaría. Cualquiera
  puede crear un equipo, así que quien configura un webhook no es de fiar. Una IP escrita en la URL no
  pasa por el `lookup`, por lo que se comprueba aparte antes de conectar; `HttpWebhookSender` se llama así
  (no `Fetch…`) por esto.
- **`isPublicAddress` usa `net.BlockList`**, con una trampa: `BlockList` compara cualquier IPv4 como si
  estuviera empaquetado en IPv6, así que la regla `::ffff:0:0/96` bloqueaba **todo IPv4**. Va en una
  lista aparte que solo se consulta con direcciones IPv6. Un test con direcciones públicas lo fija.
- **La política del sender es inyectable** (`allowHttp`, `isAllowedAddress`, reintentos y reloj) para
  probar contra un servidor local sin red real. En producción son los valores por defecto. El e2e
  usa el sender real redirigiendo un dominio de prueba `https` al receptor local.
- **Qué cuenta como entregado**: `2xx`. Un `4xx` y un `3xx` son rechazos y no se reintentan; un `5xx`,
  un fallo de red o pasar de 5 s (en total, no por inactividad) se reintentan. El `X-PP-Delivery` se
  repite en los reintentos para que el receptor pueda deduplicar; `X-PP-Timestamp` cambia en cada
  intento.
- **`webhook_failed` es un evento efímero** (sin `version`, como `emoji_thrown`), con `issueId` o
  `null` (la importación no es de una tarea). Para emitirlo, `RealtimeBroadcaster` gana `notifyGame`. La
  sala lo enseña con el mismo `Toast` que sus otros avisos.
- **«Enviar resumen» espera el resultado y no reintenta**: lo pide una persona, así que cada webhook
  recibe una sola entrega y la respuesta es `{ delivered, failed }` (sin URLs). Puede pedirlo cualquier
  participante de la partida (`Game.assertParticipant`); la página de resumen usa la identidad que el
  navegador guarda de esa partida y no ofrece el botón sin ella. `GET /api/games/:id/summary` añade
  `canSendToTeam` (hay un webhook suscrito a `session.summary`) en `GameSummaryResponseView`; el cuerpo
  del webhook sigue siendo el `GameSummaryView` puro.
- **`ping` no se suscribe** (no está en `WEBHOOK_EVENTS`) y lleva `game: null`. «Enviar prueba» es
  una sola entrega sin reintentos y devuelve el código HTTP o el motivo.
- **`key` es `null` si la tarea no tiene enlace**; `numericEstimate` es `null` para tallas, `?` y `☕`.
  Para `issue.estimated`, `rounds` y `agreementPercentage` salen del resumen de sesión (rondas
  reveladas, acuerdo de la última).
- **El enlace de la partida en el cuerpo** se construye con `CORS_ORIGIN`, que ya es el origen del
  front, para no añadir una variable de entorno más.
- **Persistencia**: los webhooks son inmutables (solo se añaden y se quitan), así que
  `PostgresTeamRepository.save` los sincroniza por diferencia dentro de la misma transacción que el
  equipo, y el orden es el de `created_at`. Borrar y reinsertarlos habría dejado el mismo `created_at`
  y un orden inestable. La migración `0010` activa RLS (ADR 0013) y la FK borra en cascada.
- **El secreto lo genera `RandomSecretGenerator`** (32 bytes del sistema, en hexadecimal) detrás del
  puerto `SecretGenerator`, distinto de `IdGenerator` porque tiene que ser impredecible.
- **Error HTTP existente que salió a la luz**: `requestJson` de `teamsClient` mandaba siempre
  `content-type: application/json`, y Fastify responde `400 FST_ERR_CTP_EMPTY_JSON_BODY` a un `DELETE`
  o `POST` sin cuerpo con esa cabecera. Borrar una baraja personalizada desde la web fallaba por eso.
  Ahora no se manda la cabecera sin cuerpo, lo que arregla también el borrado de barajas.

## Consecuencias

- Sustituye el diseño anterior de este bloque (puerto `IssueTracker` con un adaptador por gestor y
  credenciales cifradas). Ese puerto queda como posible bloque futuro si algún gestor lo merece; no
  hace falta ahora.
- No hay importación automática desde el gestor: se sigue usando el bloque 15.
- Configurar el receptor es trabajo del equipo; `docs/08-webhooks.md` trae el esquema, la
  verificación de la firma y recetas para Jira Automation, n8n y GitHub. Las recetas no se han
  probado contra una instancia real de esas herramientas.
- Primera vez que la api hace peticiones salientes: timeout, tests contra un servidor HTTP local y
  nunca red real en CI.
- Un receptor tiene que estar en una dirección pública y por `https`: uno en una red privada o en
  `localhost` no se puede alcanzar, y para probar en local hace falta un túnel.
- Sin registro de entregas ni reenvío manual: si el receptor está caído más de ~31 s, o la api se
  reinicia a mitad, esa entrega se pierde y solo queda el aviso a la sala (que tampoco se conserva).
- La URL de un webhook (que en Jira Automation, Zapier o Make suele llevar un secreto) la ve cualquiera
  con el enlace del equipo, igual que sus barajas y su histórico.
- GitHub no puede ser el receptor directo (`repository_dispatch` exige un token y un cuerpo propio):
  hace falta un intermediario, y la guía lo dice.
