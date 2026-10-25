# 0028 — Webhooks salientes en vez de integrar un gestor concreto

_Borrador escrito al planificar el bloque 20 (`docs/07-plan-v2.md` §12). Actualizar en la PR del
bloque si la implementación se desvía._

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
  votos quedan fuera por el mismo motivo que en el resumen (ADR 0025).
- **Entrega en segundo plano, que nunca bloquea la partida.** Un `EventPublisher` compuesto reenvía
  los eventos de dominio a `DispatchWebhooks`. Reintentos en memoria (3, con espera creciente) y
  aviso `webhook_failed` a la sala si se agotan. No hay outbox: una entrega en curso se pierde si
  la api se reinicia. Para una herramienta interna no compensa una cola persistente.
- **Protección SSRF obligatoria.** La api llama a URLs que introduce el usuario, así que solo
  `https`, sin seguir redirecciones, y rechazo de destinos que resuelven a direcciones privadas,
  loopback, link-local o de metadatos.
- `issueKeyFromUrl` pasa a `packages/contracts` para que la api pueda poner la `key` de la tarea
  (`ABC-123`) en el cuerpo, que es lo que necesita el receptor para encontrarla en su gestor.

## Consecuencias

- Sustituye el diseño anterior de este bloque (puerto `IssueTracker` con un adaptador por gestor y
  credenciales cifradas). Ese puerto queda como posible bloque futuro si algún gestor lo merece; no
  hace falta ahora.
- No hay importación automática desde el gestor: se sigue usando el bloque 15.
- Configurar el receptor es trabajo del equipo; `docs/08-webhooks.md` (lo crea el bloque) trae el
  esquema, la verificación de la firma y recetas para Jira Automation, n8n y GitHub.
- Primera vez que la api hace peticiones salientes: timeout, tests contra un servidor HTTP local y
  nunca red real en CI.
