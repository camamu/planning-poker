# 08 — Webhooks salientes

Guía para **quien configura el receptor** (no para Claude Code). Explica qué envía Planning Poker,
cómo verificar que un envío es de verdad suyo y cómo conectarlo con Jira Automation, n8n o una
GitHub Action. La decisión de diseño está en `docs/adr/0028-webhooks-salientes.md`.

La app **no integra ningún gestor de tareas**: cuando pasa algo relevante en una partida de un
equipo, hace un `POST` a las URLs que ese equipo haya dado de alta, y es el receptor quien lo traduce
a su herramienta.

## Configurarlo

En la página del equipo (`/t/<slug>?k=<token>`), pestaña **Webhooks**:

1. Escribe la URL del receptor (siempre `https`) y marca los eventos que quieres recibir.
2. **Copia el secreto que aparece al crearlo**: es la única vez que se enseña completo. Después el
   listado solo muestra sus 4 últimos caracteres. Si lo pierdes, borra el webhook y crea otro.
3. «Enviar prueba» manda un `ping` y te dice con qué código contestó tu receptor.

Un equipo puede tener hasta **3 webhooks**. Solo envían las partidas **creadas desde ese equipo**
(`/?team=<slug>`); una partida sin equipo no envía nada.

## Qué se envía y cuándo

| Evento            | Cuándo                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| `issue.estimated` | Al aceptar la estimación de una tarea («Aceptar … y pasar página»).                  |
| `issues.imported` | Al importar tareas desde texto, CSV o enlaces.                                       |
| `session.summary` | Al pulsar «Enviar resumen» en la página de resumen (hace falta un webhook suscrito). |
| `ping`            | Al pulsar «Enviar prueba». No se puede suscribir: es solo para comprobar.            |

**Nunca se envían votos individuales**, solo agregados (mismo criterio que el resumen de sesión).

### Cabeceras

| Cabecera         | Contenido                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `Content-Type`   | `application/json`                                                                                       |
| `User-Agent`     | `planning-poker-webhooks/1`                                                                              |
| `X-PP-Event`     | `issue.estimated`, `issues.imported`, `session.summary` o `ping`                                         |
| `X-PP-Delivery`  | Identificador de la entrega. **Se repite en los reintentos**: úsalo para no procesar dos veces lo mismo. |
| `X-PP-Timestamp` | Segundos Unix del momento de cada intento (cambia en cada reintento).                                    |
| `X-PP-Signature` | `sha256=<hex>`: HMAC-SHA256 de `"<timestamp>.<cuerpo>"` con el secreto del webhook.                      |

### Cuerpo

Todos comparten la misma envoltura, con `version: 1`:

- `event`: el mismo valor que `X-PP-Event`.
- `deliveryId`: el mismo valor que `X-PP-Delivery`.
- `occurredAt`: cuándo ocurrió el hecho, en ISO 8601 (no cuándo se envió).
- `team`: `{ slug, name }`.
- `game`: `{ id, name, url }`, con el enlace a la partida; `null` en un `ping`.
- `data`: depende del evento.

La forma exacta de cada cuerpo está en `packages/contracts/src/webhooks.ts` (`webhookEnvelopeSchema`);
los ejemplos de abajo se comprueban contra ese esquema en los tests.

#### `issue.estimated`

`key` sale del enlace de la tarea: `ABC-123` en Jira (`/browse/ABC-123`), `repo#42` en GitHub
(`/owner/repo/issues/42`), `ENG-12` en Linear; en cualquier otro enlace, el último tramo de la ruta.
Es `null` si la tarea no tiene enlace. `numericEstimate` es `null` si la carta no es un número
(`M`, `?`, `☕`). `rounds` cuenta las rondas reveladas y `agreementPercentage` es el de la última.

```json
{
  "version": 1,
  "event": "issue.estimated",
  "deliveryId": "5b0b7c1e-3f5e-4a53-9a43-0a1d2f6f9d11",
  "occurredAt": "2026-10-29T10:15:30.000Z",
  "team": { "slug": "backend-ab12cd", "name": "Backend" },
  "game": {
    "id": "0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa",
    "name": "Sprint 42",
    "url": "https://planning-poker.example/games/0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa"
  },
  "data": {
    "issueId": "7c1f9a22-0e5d-43a5-b8d2-5d1c0f6a4e10",
    "title": "Login con SSO",
    "key": "ABC-123",
    "externalUrl": "https://acme.atlassian.net/browse/ABC-123",
    "finalEstimate": "5",
    "numericEstimate": 5,
    "rounds": 2,
    "agreementPercentage": 100
  }
}
```

#### `issues.imported`

```json
{
  "version": 1,
  "event": "issues.imported",
  "deliveryId": "0c3a62a8-9a1b-4d57-8e2a-7a2b1b4f0c33",
  "occurredAt": "2026-10-29T09:00:00.000Z",
  "team": { "slug": "backend-ab12cd", "name": "Backend" },
  "game": {
    "id": "0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa",
    "name": "Sprint 42",
    "url": "https://planning-poker.example/games/0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa"
  },
  "data": {
    "issues": [
      {
        "issueId": "7c1f9a22-0e5d-43a5-b8d2-5d1c0f6a4e10",
        "title": "Login con SSO",
        "key": "ABC-123",
        "externalUrl": "https://acme.atlassian.net/browse/ABC-123"
      },
      {
        "issueId": "2e8d4b90-1c47-4c8f-a9d3-6b7e5f0a1c22",
        "title": "Informe mensual",
        "key": null,
        "externalUrl": null
      }
    ]
  }
}
```

#### `session.summary`

`data` es el mismo resumen que enseña la página (`GameSummaryView`): totales y una fila por tarea.
Solo recoge rondas reveladas.

```json
{
  "version": 1,
  "event": "session.summary",
  "deliveryId": "9e1d7f64-52c0-4f0b-a6c1-3d8e2b7a5f44",
  "occurredAt": "2026-10-29T11:30:00.000Z",
  "team": { "slug": "backend-ab12cd", "name": "Backend" },
  "game": {
    "id": "0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa",
    "name": "Sprint 42",
    "url": "https://planning-poker.example/games/0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa"
  },
  "data": {
    "id": "0d9f4a3e-6a50-4b6e-8f77-2f43c4a1b9aa",
    "name": "Sprint 42",
    "issues": [
      {
        "id": "7c1f9a22-0e5d-43a5-b8d2-5d1c0f6a4e10",
        "title": "Login con SSO",
        "description": null,
        "externalUrl": "https://acme.atlassian.net/browse/ABC-123",
        "status": "ESTIMATED",
        "finalEstimate": "5",
        "rounds": 2,
        "agreementPercentage": 100,
        "average": 5,
        "durationMs": 240000
      }
    ],
    "totals": {
      "estimatedCount": 1,
      "pendingCount": 0,
      "points": 5,
      "nonNumericEstimates": {},
      "unanimousCount": 1,
      "multiRoundCount": 1,
      "averageDurationMs": 240000,
      "voterCount": 4
    }
  }
}
```

#### `ping`

Sin partida ni datos: solo la envoltura y el equipo.

```json
{
  "version": 1,
  "event": "ping",
  "deliveryId": "f2c8a1d0-7b3e-4e59-9d16-8a0c5e3b7d55",
  "occurredAt": "2026-10-29T12:00:00.000Z",
  "team": { "slug": "backend-ab12cd", "name": "Backend" },
  "game": null,
  "data": {}
}
```

## Verificar la firma

La firma demuestra que el envío lo ha hecho Planning Poker con el secreto de **ese** webhook, y la
marca de tiempo permite rechazar un envío repetido pasado un margen (recomendado: **5 minutos**).
Hay que calcularla sobre el **cuerpo tal como llegó**, sin volver a serializar el JSON.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

/** `rawBody` es el cuerpo en texto, exactamente como llegó; `headers` con los nombres en minúsculas. */
export function verifyPlanningPokerWebhook(secret, headers, rawBody, toleranceSeconds = 300) {
  const timestamp = headers['x-pp-timestamp'];
  const received = headers['x-pp-signature'];
  if (!timestamp || !received) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const expected = `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Con Express, hay que guardar el cuerpo en bruto antes de interpretarlo:
`app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }))`.

## Cómo responder y qué pasa si falla

- **Cualquier `2xx` es «entregado».** Contesta rápido (el límite es de **5 segundos**) y procesa
  después si hace falta.
- Un **`4xx` no se reintenta**: se entiende que el receptor ha rechazado el envío.
- Un **`5xx`, un fallo de red o pasar de los 5 segundos se reintenta 3 veces**, esperando 1 s, 5 s y
  25 s (con el mismo `X-PP-Delivery`).
- Una **redirección (`3xx`) no se sigue** y cuenta como fallo: pon en el webhook la URL final.
- Si se agotan los reintentos, la sala ve un aviso («No se pudo avisar a un webhook del equipo») y
  la acción que lo provocó **no se deshace**: la estimación o la importación siguen guardadas.
- Los reintentos viven en memoria: si la API se reinicia a mitad, esa entrega se pierde. No hay
  histórico ni reenvío manual. El orden entre envíos no está garantizado.

### Dónde puede estar el receptor

Solo en una dirección **pública** y por `https`. La API se niega a llamar a `localhost`, a redes
privadas (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), a direcciones de enlace local o de
metadatos de la nube (`169.254.0.0/16`) y a cualquier nombre que resuelva a una de ellas. Para
probar en local, expón tu receptor con un túnel `https` (por ejemplo, el de tu proveedor de
funciones o un túnel de desarrollo).

La URL de un webhook la ve cualquiera que tenga el enlace del equipo. Si tu herramienta pone un
secreto en la propia URL (Jira Automation, Zapier, Make), trátala como tal.

## Recetas

> Estas recetas describen la forma de conectar cada herramienta; **no se han probado contra una
> instancia real** de Jira, n8n ni GitHub. Los nombres de pantallas y campos de cada herramienta
> cambian con el tiempo: si alguno no coincide, el dato que necesitas siempre está en el cuerpo de
> arriba.

### Jira Automation: actualizar los story points al aceptar una estimación

Suscribe el webhook a `issue.estimated` y crea una regla en Jira (Configuración del proyecto →
Automatización):

1. **Disparador**: «Incoming webhook». Copia la URL que genera Jira y úsala como URL del webhook en
   Planning Poker. Jira no verifica nuestra firma: la propia URL es el secreto.
2. **Acción** «Buscar incidencias» (Lookup issues) con la JQL `key = {{webhookData.data.key}}`.
3. **Acción** «Editar incidencia» sobre las incidencias encontradas: en el campo de story points
   (en proyectos nuevos, «Story point estimate») pon `{{webhookData.data.numericEstimate}}`.
4. Opcional: una condición que compruebe que `{{webhookData.data.numericEstimate}}` no está vacío,
   para que una talla (`M`) no intente escribirse en un campo numérico.

Para que la regla encuentre la tarea, importa las tareas en Planning Poker con su enlace de Jira
(`https://<sitio>.atlassian.net/browse/ABC-123`): de ahí sale `key`.

### n8n: del webhook a Linear o GitHub

1. Un nodo **Webhook** (método `POST`, formato JSON) cuya URL de producción pones en Planning Poker.
   Activa la opción de recibir el cuerpo en bruto si vas a verificar la firma.
2. Opcional: un nodo **Code** con la función de verificación de arriba.
3. Un nodo **Switch** por `{{$json.body.event}}`.
4. Para `issue.estimated`: el nodo de **Linear** («Update issue») o el de **GitHub** («Edit issue»),
   usando `{{$json.body.data.key}}` para localizar la tarea y `{{$json.body.data.finalEstimate}}`
   para escribir la estimación (por ejemplo, como etiqueta `estimate:5`).

### GitHub Action vía `repository_dispatch`

GitHub **no puede recibir este webhook directamente**: su API de `repository_dispatch` exige una
cabecera `Authorization` con un token y un cuerpo con `event_type`, y Planning Poker no los envía.
Hace falta un intermediario que traduzca (n8n, Make, Zapier o una función propia) y haga:

```http
POST https://api.github.com/repos/<owner>/<repo>/dispatches
Authorization: Bearer <token con permiso sobre el repositorio>
Accept: application/vnd.github+json

{ "event_type": "planning-poker-estimate", "client_payload": { "key": "ABC-123", "estimate": "5" } }
```

y, en el repositorio, un workflow con `on: repository_dispatch: types: [planning-poker-estimate]`
que lea `github.event.client_payload.key` y `github.event.client_payload.estimate`.
