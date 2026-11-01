# 0023 — Importar tareas desde texto, CSV o URLs

_Implementado en el bloque 15 (`docs/07-plan-v2.md` §7)._

## Contexto

Las tareas se añaden de una en una. Antes de una planificación el equipo ya tiene la lista en su
gestor, y copiarla título a título es lento. `01-especificacion.md` §1.2 apostó por CSV y pegado de
URLs como alternativa barata a integrar Jira o Linear (F16, F17).

## Decisión

- **`Game.importIssues(entries, now)`** añade todas o ninguna y registra **un único evento**
  `IssuesImported`. Con un `IssueAdded` por tarea, el front haría un `resync` por cada una. Crea
  todas las `Issue` antes de añadir ninguna, así que un título vacío no deja la cola a medias. Una
  lista vacía no cambia nada y no emite nada; el borde ya la rechaza con 400, esto es solo defensa.
  Como `addIssue`, no pide `requestedBy`: la cola es de toda la sala.
- **`addIssue` acepta `description` y `externalUrl`** (un tercer parámetro `IssueDetails`), y
  `startQuickRound` sigue usándolo sin cambios.
- **El parseo vive en el cliente** (`parseIssueInput`, función pura sin dependencias): el usuario ve
  una vista previa y elige filas antes de enviar, y el servidor solo recibe una lista ya
  estructurada (`POST /api/games/:id/issues/batch`, máximo 200, responde `201 { issueIds }`). Así el
  contrato no depende de formatos de CSV de terceros.
- **Detección de formato**: cabecera CSV reconocible → CSV; si no, una tarea por línea; una línea
  que es solo un enlace → tarea con enlace y título derivado de la clave (Jira, GitHub, Linear, o
  último segmento del path).
  - Se reconoce como cabecera una primera línea con al menos una columna conocida: título
    (`summary`, `title`, `titulo`), clave (`key`, `issue key`), descripción (`description`,
    `descripcion`) o enlace (`link`, `url`), sin distinguir mayúsculas ni tildes. El resto de
    columnas (`estimate`, `status`…) se ignora.
  - El separador se detecta entre `,`, `;` y **tabulador** (no estaba en el plan: es lo que llega al
    pegar desde una hoja de cálculo) por el que más aparece en la primera línea.
  - Una fila sin título usa la clave y, en último caso, la clave derivada del enlace; si no tiene
    nada de eso se salta. Un enlace que no es http(s) se descarta en vez de tumbar el lote entero.
  - Soporta RFC 4180: comillas, comillas dobles escapadas y saltos de línea dentro de una celda,
    BOM UTF-8 y CRLF.
- **`issueKeyFromUrl` es compartida** (`packages/contracts/src/issueKey.ts`, función pura): la
  exportación del bloque 18 la usa para la columna `key`, de modo que exportar e importar son
  simétricos, y los webhooks del bloque 20 la usan en la api para el mismo campo. Junto a ella,
  `isHttpUrl`, para que el parser, la lista (que solo pinta como enlace lo que lo es) y el borde
  coincidan en qué es una URL válida.
- `IssueView` expone por fin `description` y `externalUrl` (`string | null`; una descripción vacía,
  que es como se borra al editar, sale como `null`). `addIssueCommandSchema` los acepta con la misma
  validación que `editIssueCommandSchema` (`externalUrl` solo http/https, para que nunca llegue un
  `javascript:` a un `href`).
- **Límite de 200**: lo impone el borde (`MAX_IMPORTED_ISSUES`, exportado desde `contracts`) y el
  front lo usa para avisar. Con más de 200 filas marcadas el botón se deshabilita y se explica
  (desmarcar o importar por partes), en vez de truncar en silencio.
- **Interfaz**: «Importar tareas…» en el pie del panel de la cola abre un diálogo ancho (`Modal`
  gana `size="wide"`) con área de texto, subida de `.csv`/`.txt`, y una tabla de vista previa con
  casilla por fila. Las tareas con enlace muestran un icono ↗ que lo abre en pestaña nueva.
- `issues_imported` lleva solo `issueIds` y el cliente hace **un** `resync` (`needsResync`), como
  `issue_added`.

## Consecuencias

- Sin migración: `issues.description` y `issues.external_url` existen desde `0001` y el mapper ya
  los escribía; el test de contrato fija que sobreviven a `save` + `findById`.
- El título derivado de una URL es solo la clave (`ABC-123`), no el resumen real de la tarea: leerlo
  exigiría llamar a la API de cada gestor, que el plan descarta (ADR 0028).
- El límite de 200 protege el `save()`, que reescribe todas las issues de la partida, **por
  petición**: varias importaciones seguidas pueden acumular más de 200 tareas en una partida. No se
  fija un tope por partida porque nadie lo ha pedido; si hiciera falta sería una regla del agregado.
- `packages/contracts` gana un `tsconfig.build.json` (solo `src`, el que usa `build`) y su
  `tsconfig.json` pasa a incluir `tests/`, como ya hacía `apps/api`: así el paquete puede tener tests
  que `typecheck` y ESLint ven sin que acaben en `dist`.
- Los CSV de Jira o Linear que pueda exportar el equipo no se han probado contra exportaciones
  reales, solo contra su forma documentada (cabeceras `Summary`/`Issue key`/`Description` y
  `ID`/`Title`/`Description`); si alguna variante no se reconoce, el síntoma es la vista previa vacía
  y el arreglo, añadir el nombre de columna.
