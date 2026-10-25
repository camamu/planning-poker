# 0023 — Importar tareas desde texto, CSV o URLs

_Borrador escrito al planificar el bloque 15 (`docs/07-plan-v2.md` §7). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

Las tareas se añaden de una en una. Antes de una planificación el equipo ya tiene la lista en su
gestor, y copiarla título a título es lento. `01-especificacion.md` §1.2 apostó por CSV y pegado de
URLs como alternativa barata a integrar Jira o Linear (F16, F17).

## Decisión

- **`Game.importIssues(entries, now)`** añade todas o ninguna y registra **un único evento**
  `IssuesImported`. Con un `IssueAdded` por tarea, el front haría un `resync` por cada una.
- **El parseo vive en el cliente** (`parseIssueInput`, función pura sin dependencias): el usuario ve
  una vista previa y elige filas antes de enviar, y el servidor solo recibe una lista ya
  estructurada (`POST /api/games/:id/issues/batch`, máximo 200). Así el contrato no depende de
  formatos de CSV de terceros.
- **Detección de formato**: cabecera CSV reconocible → CSV (separador `,` o `;`); si no, una tarea
  por línea; una línea que es una URL → tarea con enlace y título derivado de la clave (Jira, GitHub,
  Linear, o último segmento del path).
- **`issueKeyFromUrl` es compartida** (`shared/issues/issueKey.ts`): la exportación del bloque 18
  la usa para la columna `key`, de modo que exportar e importar son simétricos.
- `IssueView` expone por fin `description` y `externalUrl`, que ya estaban en dominio y BD.

## Consecuencias

- Sin migración: `issues.description` y `issues.external_url` existen desde `0001`.
- El título derivado de una URL es solo la clave (`ABC-123`), no el resumen real de la tarea: leerlo
  exigiría llamar al gestor, que es el bloque 20.
- El límite de 200 protege el `save()`, que reescribe todas las issues de la partida.
