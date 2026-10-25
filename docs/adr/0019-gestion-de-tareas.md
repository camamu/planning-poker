# 0019 — Editar, borrar y reordenar tareas

_Borrador escrito al planificar el bloque 11 (`docs/07-plan-v2.md` §3). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

`Issue` solo se podía crear. Un título con una errata, una tarea añadida dos veces o una cola en el
orden equivocado obligaban a convivir con el error durante toda la sesión. F10 de
`01-especificacion.md` pedía crear, ordenar, editar y marcar.

## Decisión

- **`Game.editIssue`, `Game.removeIssue` y `Game.reorderIssues`**, con eventos `IssueEdited`,
  `IssueRemoved` e `IssuesReordered`. Los tres los puede usar cualquier participante que no haya
  salido, mismo criterio que `addIssue`: la cola es de toda la sala.
- **Solo se borra una tarea que nunca ha tenido ronda** (`IssueHasRoundsError`). Una tarea votada
  tiene rondas y votos que forman parte del histórico (F7, bloques 16-17); borrarla los perdería, y
  `currentRound()` podría pasar a apuntar a otra ronda. Para corregir una tarea votada se edita.
  Descartamos el borrado lógico: añade un estado a `Issue` para un caso raro.
- **Reordenar exige una permutación exacta** (`InvalidIssueOrderError`). Un orden parcial obligaría
  a decidir dónde van las que faltan, y dos clientes reordenando a la vez producirían resultados
  distintos según quién llegue primero.
- **Persistencia sin cambios**: `PostgresGameRepository.save()` reescribe las issues en el orden del
  agregado, así que borrar y reordenar se guardan solos.
- **Eventos parcheables** (`issue_edited` con la `IssueView`, `issue_removed`, `issues_reordered`
  con los ids en orden): el front no necesita `resync`.

## Consecuencias

- `Issue.title`, `description` y `externalUrl` dejan de ser `readonly`.
- El dealer se calcula con la posición de la tarea actual (`Game.currentDealer()`): reordenar con
  una ronda abierta puede cambiar quién reparte en esa ronda. Se acepta: es cosmético y el siguiente
  cambio de tarea lo normaliza.
- Una tarea creada por error con «Votar ya» no se puede borrar, solo renombrar.
