# 0026 — Exportación a CSV y Markdown en el cliente

_Implementado en el bloque 18 (`docs/07-plan-v2.md` §10)._

## Contexto

El resultado de la sesión acaba en el gestor de tareas o en un documento. F7 y F16 pedían
exportarlo. El resumen del bloque 17 ya trae todos los datos necesarios.

## Decisión

- **Se genera en el navegador** a partir de `GameSummaryView`, con funciones puras `toCsv` y
  `toMarkdown` (`features/session-summary/export/`). El servidor sigue hablando solo JSON: no gana
  dependencias, cabeceras de descarga ni formatos que versionar, y la exportación funciona con lo
  que ya se ha cargado.
- **CSV compatible con la importación**: columnas `summary, key, description, link, estimate,
rounds, agreement`. Las cuatro primeras y el orden son las que reconoce `parseIssueInput`
  (ADR 0023); `estimate`, `rounds` y `agreement` las ignora al importar. `key` sale de
  `issueKeyFromUrl`, la misma función que usa el bloque 15, y vacía si la tarea no tiene enlace.
  Un test de ida y vuelta (`parseIssueInput(toCsv(x))`) fija que títulos, descripciones y enlaces
  sobreviven, con `;` y con `,`.
- **RFC 4180**: se entrecomilla solo lo que lo necesita (el separador en uso, comillas, saltos de
  línea), las comillas se duplican, las filas acaban en CRLF y el fichero empieza con el BOM de
  UTF-8. Una coma dentro de un título solo se entrecomilla cuando el separador es la coma.
- **Separador `;` por defecto**: Excel con configuración regional española espera `;` y abre mal un
  CSV con comas. Se ofrece `,` como opción para otras herramientas, con un selector «Separador del
  CSV» junto al botón (sin él, la opción solo existiría en el código).
- **Una celda de texto que empieza por `=`, `+`, `-`, `@`, tabulador o retorno de carro se
  desactiva con un apóstrofo** (no estaba en el plan). Los títulos los escribe cualquiera de la
  sala y quien exporta abre el fichero en una hoja de cálculo, que ejecutaría `=HYPERLINK(…)` como
  fórmula. Solo se aplica a las columnas de texto, no a los números.
- **Markdown** como tabla `Tarea | Estimación | Rondas | Acuerdo` con el título enlazado si hay URL
  y una línea final `**Total:** …` (tareas estimadas, puntos o tallas, y las que quedan sin
  estimar). Una tarea sin estimar enseña su estado («Pendiente», «En votación») en lugar de la
  estimación, igual que la tabla de la pantalla (`ISSUE_STATUS_LABELS`, compartida desde
  `summaryFormat.ts`). Se escapa `|` —lo que pide el plan— y también el resto de caracteres que
  Markdown interpretaría en un título (`\ [ ] * _ \` < > &`), y se codifican en la URL los paréntesis,
  las barras verticales y los espacios, que cerrarían el enlace o la celda.
- **Nombre de fichero** `planning-<nombre-de-partida>-<aaaa-mm-dd>.csv`: el nombre sin tildes ni
  signos, en minúsculas y recortado a 50 caracteres; `partida` si no queda nada aprovechable. La
  fecha es la del navegador de quien exporta.
- **Descarga y portapapeles**: un `Blob` con `URL.createObjectURL` y un enlace temporal
  (`downloadTextFile`); `navigator.clipboard.writeText` para el Markdown, con aviso «No se pudo
  copiar» si el navegador lo rechaza o no hay portapapeles (contextos no seguros).
- Los botones solo se ofrecen si la partida tiene tareas. El CSV no incluye la duración: el plan no
  la pedía y el resumen en pantalla ya la enseña.

## Consecuencias

- Sin cambios en api ni en contratos.
- Como el resumen no lleva votos individuales (ADR 0025), tampoco los lleva ninguna exportación.
- Un título que empiece por `=`, `+`, `-` o `@` vuelve a importarse con el apóstrofo delante: es el
  precio de que el fichero sea seguro en Excel. El importador no lo quita porque no puede saber si
  el apóstrofo es de la exportación o del usuario.
- Los CSV no se han abierto en Excel, Numbers o Calc reales, solo se han comprobado contra las
  reglas de RFC 4180 y contra la importación del propio proyecto; si alguna hoja de cálculo los
  abre mal, el síntoma será de codificación (BOM) o de separador, y el arreglo está en `toCsv`.
- Si algún día hace falta exportar sin abrir la app (p. ej. desde una integración), habrá que mover
  estas funciones a `packages/contracts` o a la api; son puras, así que el cambio es mecánico.
