# 0028 — Integración con un gestor de tareas

_Borrador escrito al planificar el bloque 20 (`docs/07-plan-v2.md` §12). **Requiere decidir el
gestor (Jira Cloud, Linear o GitHub Issues) antes de empezar el bloque.**_

## Contexto

Con la importación por URLs y CSV (ADR 0023) y la exportación (ADR 0026), llevar tareas y
estimaciones entre la app y el gestor sigue siendo manual. `01-especificacion.md` situaba las
integraciones en v3 (F18, F19) por coste. Para una herramienta interna basta con integrar el gestor
que usa el equipo.

## Decisión

- **Puerto `IssueTracker`** (`search`, `writeEstimate`) en `application/ports` y un único adaptador
  del gestor elegido en `infrastructure/trackers/`, con `fetch` nativo. Otro gestor después es otro
  adaptador, sin tocar dominio ni casos de uso.
- **Configuración por equipo** en `team_integrations`. Sin cuentas, el equipo es el único dueño
  posible de una credencial; las partidas sin equipo no integran.
- **Credenciales cifradas** con AES-256-GCM (`node:crypto`) y una clave `INTEGRATIONS_KEY` validada
  en `env.ts`, distinta de `SESSION_SECRET` para poder rotarlas por separado. Nunca salen hacia el
  cliente ni aparecen en `TeamView`.
- **La escritura de vuelta no bloquea la partida**: un `EventPublisher` compuesto reenvía
  `IssueEstimated` a `SyncEstimateToTracker`. Si el gestor falla, la estimación queda hecha en la
  app y se avisa a la sala con `tracker_sync_failed`. El dominio no sabe que existe el gestor.
- **`Issue.externalKey`** (migración `0010`) identifica la tarea en el gestor; `externalUrl` sigue
  siendo solo un enlace.

## Consecuencias

- Primera llamada de la api a un servicio externo: hace falta timeout y que los tests usen un
  servidor HTTP falso, nunca la red real.
- Una variable de entorno nueva en Render y en `.env.example`.
- Las estimaciones no numéricas solo se escriben si la integración define un mapeo.
