# 0019 — Editar, borrar y reordenar tareas

_Implementado en el bloque 11 (`docs/07-plan-v2.md` §3). Desviaciones respecto al borrador, abajo._

## Contexto

`Issue` solo se podía crear. Un título con una errata, una tarea añadida dos veces o una cola en el
orden equivocado obligaban a convivir con el error durante toda la sesión. F10 de
`01-especificacion.md` pedía crear, ordenar, editar y marcar.

## Decisión

- **`Game.editIssue`, `Game.removeIssue` y `Game.reorderIssues`**, con eventos `IssueEdited`,
  `IssueRemoved` e `IssuesReordered`. Los tres los puede usar cualquier participante que no haya
  salido, mismo criterio que `addIssue`: la cola es de toda la sala.
- **Editar vale para cualquier tarea**, también la que se está votando o ya está estimada: es la
  forma de corregir una tarea votada. `description` y `externalUrl` ausentes dejan lo que había
  (renombrar no borra datos que ponga el bloque 15); `title` se valida igual que en `Issue.create`.
  `externalUrl` se valida en el borde y solo admite `http(s)`, porque se pintará como enlace.
- **Solo se borra una tarea que nunca ha tenido ronda** (`IssueHasRoundsError`). Una tarea votada
  tiene rondas y votos que forman parte del histórico (F7, bloques 16-17); borrarla los perdería, y
  `currentRound()` podría pasar a apuntar a otra ronda. Descartamos el borrado lógico: añade un
  estado a `Issue` para un caso raro. En la UI, `status === 'PENDING'` equivale a «nunca ha tenido
  ronda» (el estado solo avanza), así que «Borrar» se ofrece exactamente en esas tareas.
- **Reordenar exige una permutación exacta** (`InvalidIssueOrderError`). Un orden parcial obligaría
  a decidir dónde van las que faltan, y dos clientes reordenando a la vez producirían resultados
  distintos según quién llegue primero. Si un cliente desfasado manda una cola que ya no coincide,
  recibe 422: revierte, muestra el motivo y pide un `state_sync`.
- **El front solo mueve tareas por estimar**, con arrastre nativo (sin librería) y botones
  «subir / bajar» como alternativa accesible. Manda siempre la cola entera: las tareas por estimar
  ocupan los huecos que ya tenían y las demás no se mueven.
- **Persistencia sin cambios**: `PostgresGameRepository.save()` reescribe las issues en el orden del
  agregado, así que borrar y reordenar se guardan solos (test de contrato en las dos
  implementaciones).
- **Eventos parcheables, sin `resync`**: `issue_edited` con la `IssueView`, `issue_removed` con el
  id e `issues_reordered` con los ids en orden.
- **Cambios optimistas en el store** (`renameIssue`, `deleteIssue`, `reorderIssueQueue`): se pinta
  ya y, si la API falla, se deshace (solo si nadie más ha tocado la cola mientras tanto) y se avisa
  con el mensaje del servidor.

## Desviaciones respecto al borrador

- **`issue_removed` e `issues_reordered` llevan también `dealerId`.** El borrador aceptaba que el
  dealer cambiara al borrar o reordenar por ser «cosmético», pero con `whoCanReveal: 'DEALER'`
  decide quién ve el botón de revelar, y el servidor ya valida con el dealer nuevo. Los clientes no
  pueden recalcularlo (`Game.currentDealer()` depende del orden de entrada), así que lo trae el
  evento, que lo lee de la partida recargada en `WsEventPublisher`.

## Consecuencias

- `Issue.title`, `description` y `externalUrl` dejan de ser `readonly`; la única vía para
  cambiarlos es `Issue.rename`.
- El dealer se calcula con la posición de la tarea actual: borrar una tarea anterior a la actual
  mueve al dealer de la ronda abierta. Reordenar desde la UI no lo mueve, porque no toca la
  posición de la tarea actual; un cliente de la API sí podría.
- `IssueView` sigue sin exponer `description` ni `externalUrl` (los conecta el bloque 15), aunque el
  `PATCH` ya los acepte y los guarde.
- Una tarea creada por error con «Votar ya» no se puede borrar, solo renombrar.
- Ninguno de los tres eventos lleva votos, así que no hace falta el e2e de la invariante 7.
